import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { RenameFamilyDto } from './dto/rename-family.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { DeleteFamilyDto } from './dto/delete-family.dto';
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

  private async getFamilyOfUser(userId: string) {
    const membership = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: {
        family: { include: { members: MEMBERS_INCLUDE } },
      },
    });
    if (!membership) {
      throw new NotFoundException({
        message: "Vous n'êtes pas dans une famille",
        code: 'NOT_IN_FAMILY',
      });
    }
    return { family: membership.family as FamilyRow, membership };
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

  async regenerateInviteCode(userId: string) {
    const { family, membership } = await this.getFamilyOfUser(userId);

    if (membership.role !== 'PARENT') {
      throw new ForbiddenException({
        message: 'Seuls les parents peuvent régénérer le code',
        code: 'FORBIDDEN_NOT_PARENT',
      });
    }

    const newCode = await this.generateUniqueCode();

    const updated = await this.prisma.family.update({
      where: { id: family.id },
      data: { inviteCode: newCode },
      include: { members: MEMBERS_INCLUDE },
    });

    return this.formatFamily(updated as FamilyRow);
  }

  async leaveFamily(userId: string): Promise<void> {
    const { family, membership } = await this.getFamilyOfUser(userId);

    if (membership.role === 'PARENT') {
      const parentCount = family.members.filter(
        (m) => m.role === 'PARENT',
      ).length;
      if (parentCount === 1 && family.members.length > 1) {
        throw new ForbiddenException({
          message:
            "Vous êtes le seul parent. Promouvez un autre membre avant de quitter.",
          code: 'LAST_PARENT_CANNOT_LEAVE',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.delete({
        where: { userId_familyId: { userId, familyId: family.id } },
      });
      // If we were the last member, cascade via Prisma onDelete would leave an
      // empty family — delete it explicitly instead.
      if (family.members.length === 1) {
        await tx.family.delete({ where: { id: family.id } });
      }
    });
  }

  async kickMember(callerId: string, targetUserId: string) {
    const { family, membership: callerMembership } =
      await this.getFamilyOfUser(callerId);

    if (callerMembership.role !== 'PARENT') {
      throw new ForbiddenException({
        message: 'Seuls les parents peuvent exclure des membres',
        code: 'FORBIDDEN_NOT_PARENT',
      });
    }
    if (callerId === targetUserId) {
      throw new ForbiddenException({
        message: 'Vous ne pouvez pas vous exclure vous-même',
        code: 'CANNOT_KICK_SELF',
      });
    }

    const targetMember = family.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new NotFoundException({
        message: 'Membre introuvable',
        code: 'MEMBER_NOT_FOUND',
      });
    }
    if (targetMember.role === 'PARENT') {
      throw new ForbiddenException({
        message: 'Vous ne pouvez pas exclure un parent',
        code: 'CANNOT_KICK_PARENT',
      });
    }

    await this.prisma.familyMember.delete({
      where: { userId_familyId: { userId: targetUserId, familyId: family.id } },
    });

    const updated = await this.prisma.family.findUniqueOrThrow({
      where: { id: family.id },
      include: { members: MEMBERS_INCLUDE },
    });

    return this.formatFamily(updated as FamilyRow);
  }

  async changeMemberRole(
    callerId: string,
    targetUserId: string,
    dto: ChangeMemberRoleDto,
  ) {
    const { family, membership: callerMembership } =
      await this.getFamilyOfUser(callerId);

    if (callerMembership.role !== 'PARENT') {
      throw new ForbiddenException({
        message: 'Seuls les parents peuvent modifier les rôles',
        code: 'FORBIDDEN_NOT_PARENT',
      });
    }

    const targetMember = family.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new NotFoundException({
        message: 'Membre introuvable',
        code: 'MEMBER_NOT_FOUND',
      });
    }

    if (targetMember.role === 'PARENT' && dto.role !== 'PARENT') {
      const parentCount = family.members.filter(
        (m) => m.role === 'PARENT',
      ).length;
      if (parentCount === 1) {
        throw new ForbiddenException({
          message: "Vous ne pouvez pas déclasser le dernier parent",
          code: 'LAST_PARENT_CANNOT_DEMOTE',
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.update({
        where: {
          userId_familyId: { userId: targetUserId, familyId: family.id },
        },
        data: { role: dto.role },
      });
      return tx.family.findUniqueOrThrow({
        where: { id: family.id },
        include: { members: MEMBERS_INCLUDE },
      });
    });

    return this.formatFamily(updated as FamilyRow);
  }

  async renameFamily(callerId: string, dto: RenameFamilyDto) {
    const { family, membership } = await this.getFamilyOfUser(callerId);

    if (membership.role !== 'PARENT') {
      throw new ForbiddenException({
        message: 'Seuls les parents peuvent renommer la famille',
        code: 'FORBIDDEN_NOT_PARENT',
      });
    }

    const updated = await this.prisma.family.update({
      where: { id: family.id },
      data: { name: dto.name },
      include: { members: MEMBERS_INCLUDE },
    });

    return this.formatFamily(updated as FamilyRow);
  }

  async deleteFamily(callerId: string, dto: DeleteFamilyDto): Promise<void> {
    const { family, membership } = await this.getFamilyOfUser(callerId);

    if (membership.role !== 'PARENT') {
      throw new ForbiddenException({
        message: 'Seuls les parents peuvent supprimer la famille',
        code: 'FORBIDDEN_NOT_PARENT',
      });
    }

    if (dto.confirmationName !== family.name) {
      throw new ForbiddenException({
        message: 'Le nom de confirmation ne correspond pas',
        code: 'CONFIRMATION_MISMATCH',
      });
    }

    // FamilyMember rows are deleted by Prisma's onDelete: Cascade
    await this.prisma.family.delete({ where: { id: family.id } });
  }
}
