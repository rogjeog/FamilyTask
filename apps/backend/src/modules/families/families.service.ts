import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { generateInviteCode } from './utils/invite-code.util';

// ─── Shared return shape ──────────────────────────────────────────────────────

type FamilyRow = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  members: Array<{
    userId: string;
    role: string;
    joinedAt: Date;
    user: { displayName: string; avatarUrl: string | null };
  }>;
};

const MEMBERS_INCLUDE = {
  include: { user: true },
  orderBy: { joinedAt: 'asc' as const },
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  private formatFamily(family: FamilyRow) {
    return {
      id: family.id,
      name: family.name,
      inviteCode: family.inviteCode,
      createdAt: family.createdAt,
      members: family.members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        role: m.role as 'PARENT' | 'CHILD' | 'OTHER',
        joinedAt: m.joinedAt,
      })),
    };
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const taken = await this.prisma.family.findUnique({
        where: { inviteCode: code },
      });
      if (!taken) return code;
    }
    throw new Error('Unable to generate a unique invite code after 5 attempts');
  }

  private async assertNotInFamily(userId: string): Promise<void> {
    const existing = await this.prisma.familyMember.findFirst({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Vous êtes déjà dans une famille',
        code: 'ALREADY_IN_FAMILY',
      });
    }
  }

  // ─── Public methods ──────────────────────────────────────────────────────────

  async createFamily(userId: string, dto: CreateFamilyDto) {
    await this.assertNotInFamily(userId);
    const inviteCode = await this.generateUniqueCode();

    // Nested create is a single atomic operation in Prisma (implicit transaction)
    const family = await this.prisma.family.create({
      data: {
        name: dto.name,
        inviteCode,
        members: { create: { userId, role: 'PARENT' } },
      },
      include: { members: MEMBERS_INCLUDE },
    });

    return this.formatFamily(family as FamilyRow);
  }

  async joinFamily(userId: string, dto: JoinFamilyDto) {
    await this.assertNotInFamily(userId);

    // $transaction prevents a race where the invite code is regenerated between
    // the findUnique check and the familyMember create.
    const family = await this.prisma.$transaction(async (tx) => {
      const found = await tx.family.findUnique({
        where: { inviteCode: dto.inviteCode },
      });
      if (!found) {
        throw new NotFoundException({
          message: "Code d'invitation invalide",
          code: 'INVALID_INVITE_CODE',
        });
      }

      await tx.familyMember.create({
        data: { userId, familyId: found.id, role: 'CHILD' },
      });

      return tx.family.findUniqueOrThrow({
        where: { id: found.id },
        include: { members: MEMBERS_INCLUDE },
      });
    });

    return this.formatFamily(family as FamilyRow);
  }

  async getMyFamily(userId: string) {
    const membership = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: {
        family: {
          include: { members: MEMBERS_INCLUDE },
        },
      },
    });

    if (!membership) return null;
    return this.formatFamily(membership.family as FamilyRow);
  }

  async regenerateInviteCode(userId: string, familyId: string) {
    const membership = await this.prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });

    if (!membership || membership.role !== 'PARENT') {
      throw new ForbiddenException({
        message: 'Seuls les parents peuvent régénérer le code',
        code: 'FORBIDDEN_NOT_PARENT',
      });
    }

    const newCode = await this.generateUniqueCode();

    const family = await this.prisma.family.update({
      where: { id: familyId },
      data: { inviteCode: newCode },
      include: { members: MEMBERS_INCLUDE },
    });

    return this.formatFamily(family as FamilyRow);
  }
}
