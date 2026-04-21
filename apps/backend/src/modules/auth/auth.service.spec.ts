import * as crypto from 'crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from './utils/password.util';
import { generateRefreshToken } from './utils/tokens.util';

// ─── Module-level mocks (hoisted before imports by Jest) ─────────────────────

jest.mock('./utils/password.util', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));

jest.mock('./utils/tokens.util', () => {
  // Keep hashToken and parseTtl real — only stub the random generator
  const actual = jest.requireActual<typeof import('./utils/tokens.util')>(
    './utils/tokens.util',
  );
  return { ...actual, generateRefreshToken: jest.fn().mockReturnValue('mock-plain-token') };
});

// ─── Shared constants ─────────────────────────────────────────────────────────

const MOCK_PLAIN_TOKEN = 'mock-plain-token';
const MOCK_TOKEN_HASH = crypto
  .createHash('sha256')
  .update(MOCK_PLAIN_TOKEN)
  .digest('hex');

const MOCK_USER = {
  id: 'user-id-1',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  displayName: 'Test User',
  avatarUrl: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

function buildStoredToken(
  overrides: Partial<{
    revokedAt: Date | null;
    expiresAt: Date;
  }> = {},
) {
  return {
    id: 'token-id-1',
    userId: MOCK_USER.id,
    tokenHash: MOCK_TOKEN_HASH,
    expiresAt: new Date(Date.now() + 86_400_000), // valid: +1 day
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwt = { sign: jest.fn().mockReturnValue('mock.access.token') };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              ({
                JWT_REFRESH_TTL: '30d',
                JWT_ACCESS_TTL: '15m',
                JWT_ACCESS_SECRET: 'test-secret-at-least-32-chars-long!!',
              })[key],
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish default implementations after clearAllMocks
    mockJwt.sign.mockReturnValue('mock.access.token');
    (hashPassword as jest.Mock).mockResolvedValue('hashed_password');
    (verifyPassword as jest.Mock).mockResolvedValue(true);
    (generateRefreshToken as jest.Mock).mockReturnValue(MOCK_PLAIN_TOKEN);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException with EMAIL_TAKEN when email is already used', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);

      const error = await service
        .register({ email: 'test@example.com', password: 'pass1234', displayName: 'Test' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'EMAIL_TAKEN',
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('creates user, hashes password, stores refresh token hash, returns sanitized user + tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(MOCK_USER);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          passwordHash: 'hashed_password',
          displayName: 'New User',
        },
      });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tokenHash: MOCK_TOKEN_HASH }),
        }),
      );

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshTokenPlain).toBe(MOCK_PLAIN_TOKEN);
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException with INVALID_CREDENTIALS for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
      (verifyPassword as jest.Mock).mockResolvedValueOnce(false);

      const error = await service
        .login({ email: 'test@example.com', password: 'wrong' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('returns tokens and sanitized user on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'correct',
      });

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshTokenPlain).toBe(MOCK_PLAIN_TOKEN);
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('rotates tokens and revokes old token on valid refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(buildStoredToken());
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(MOCK_USER);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(MOCK_PLAIN_TOKEN);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshTokenPlain).toBe(MOCK_PLAIN_TOKEN);
    });

    it('throws REFRESH_TOKEN_EXPIRED for an expired token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        buildStoredToken({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      const error = await service.refresh(MOCK_PLAIN_TOKEN).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    });

    it('revokes ALL user tokens and throws REFRESH_TOKEN_REUSED when token was already revoked', async () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        buildStoredToken({ revokedAt: new Date(Date.now() - 1_000) }),
      );
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const error = await service.refresh(MOCK_PLAIN_TOKEN).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'REFRESH_TOKEN_REUSED',
      });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: MOCK_USER.id },
        data: { revokedAt: expect.any(Date) },
      });
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('REUSE DETECTED'),
      );

      consoleWarn.mockRestore();
    });

    it('throws INVALID_REFRESH_TOKEN when token is not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const error = await service.refresh('unknown-token').catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('is idempotent: does not throw even if token is not found', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('nonexistent-token')).resolves.toBeUndefined();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  // ── cleanupExpiredTokens ──────────────────────────────────────────────────

  describe('cleanupExpiredTokens', () => {
    it('deletes expired and old revoked tokens and returns the deleted count', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 7 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toEqual({ deletedCount: 7 });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });
});
