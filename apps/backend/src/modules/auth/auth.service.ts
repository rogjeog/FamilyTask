import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './utils/password.util';
import { generateRefreshToken, hashToken, parseTtl } from './utils/tokens.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  private generateAccessToken(userId: string, email: string): string {
    return this.jwt.sign({ sub: userId, email });
  }

  private async storeRefreshToken(
    userId: string,
    plainToken: string,
  ): Promise<void> {
    const tokenHash = hashToken(plainToken);
    const ttl = parseTtl(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
    );
    const expiresAt = new Date(Date.now() + ttl);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  private sanitize(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: Date;
  }) {
    const { id, email, displayName, avatarUrl, createdAt } = user;
    return { id, email, displayName, avatarUrl, createdAt };
  }

  // ─── Public methods ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Email déjà utilisé',
        code: 'EMAIL_TAKEN',
      });
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, displayName: dto.displayName },
    });

    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshTokenPlain = generateRefreshToken();
    await this.storeRefreshToken(user.id, refreshTokenPlain);

    return { user: this.sanitize(user), accessToken, refreshTokenPlain };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always run verifyPassword to avoid timing-based user enumeration
    const valid = user
      ? await verifyPassword(dto.password, user.passwordHash)
      : false;

    if (!user || !valid) {
      throw new UnauthorizedException({
        message: 'Identifiants invalides',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshTokenPlain = generateRefreshToken();
    await this.storeRefreshToken(user.id, refreshTokenPlain);

    return { user: this.sanitize(user), accessToken, refreshTokenPlain };
  }

  async refresh(plainToken: string) {
    const tokenHash = hashToken(plainToken);

    // Look up without filtering on revokedAt — we need to detect reuse of revoked tokens
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException({
        message: 'Token invalide',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    if (stored.revokedAt !== null) {
      // Token was already used — potential theft. Revoke the entire family immediately.
      console.warn(
        `[AuthService] REUSE DETECTED — userId=${stored.userId}. Revoking all refresh tokens.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        message: 'Token déjà utilisé',
        code: 'REFRESH_TOKEN_REUSED',
      });
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        message: 'Token expiré',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    // Rotation: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    const accessToken = this.generateAccessToken(user.id, user.email);
    const newPlainToken = generateRefreshToken();
    await this.storeRefreshToken(user.id, newPlainToken);

    return { accessToken, refreshTokenPlain: newPlainToken };
  }

  async logout(plainToken: string): Promise<void> {
    const tokenHash = hashToken(plainToken);
    // updateMany is idempotent: no-op if already revoked or not found
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        familyMembers: {
          include: { family: true },
          // MVP: a user can technically belong to multiple families (schema supports it)
          // but we surface only the first one until multi-family UI is implemented.
          take: 1,
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    const membership = user.familyMembers[0] ?? null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      family: membership
        ? {
            id: membership.family.id,
            name: membership.family.name,
            role: membership.role,
            joinedAt: membership.joinedAt,
          }
        : null,
    };
  }

  async cleanupExpiredTokens(): Promise<{ deletedCount: number }> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: oneMonthAgo } },
        ],
      },
    });
    return { deletedCount: result.count };
  }
}
