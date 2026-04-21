import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FamiliesService } from './families.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateInviteCode } from './utils/invite-code.util';

// ─── Module-level mock ────────────────────────────────────────────────────────

jest.mock('./utils/invite-code.util', () => ({
  generateInviteCode: jest.fn().mockReturnValue('ABCDEF'),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-id-1', displayName: 'Thomas', avatarUrl: null };
const MOCK_USER2 = { id: 'user-id-2', displayName: 'Marie', avatarUrl: null };

const MOCK_FAMILY_BASE = {
  id: 'family-id-1',
  name: 'Les Moissonnier',
  inviteCode: 'ABCDEF',
  createdAt: new Date('2025-01-01'),
};

const MOCK_MEMBER = {
  userId: MOCK_USER.id,
  familyId: MOCK_FAMILY_BASE.id,
  role: 'PARENT',
  joinedAt: new Date('2025-01-01'),
};

const MOCK_MEMBER2 = {
  userId: MOCK_USER2.id,
  familyId: MOCK_FAMILY_BASE.id,
  role: 'CHILD',
  joinedAt: new Date('2025-01-02'),
};

const MOCK_FAMILY_WITH_MEMBERS = {
  ...MOCK_FAMILY_BASE,
  members: [
    {
      userId: MOCK_USER.id,
      role: 'PARENT',
      joinedAt: new Date('2025-01-01'),
      user: { displayName: 'Thomas', avatarUrl: null },
    },
  ],
};

const MOCK_FAMILY_WITH_TWO_MEMBERS = {
  ...MOCK_FAMILY_BASE,
  members: [
    {
      userId: MOCK_USER.id,
      role: 'PARENT',
      joinedAt: new Date('2025-01-01'),
      user: { displayName: 'Thomas', avatarUrl: null },
    },
    {
      userId: MOCK_USER2.id,
      role: 'CHILD',
      joinedAt: new Date('2025-01-02'),
      user: { displayName: 'Marie', avatarUrl: null },
    },
  ],
};

const MOCK_FAMILY_WITH_TWO_PARENTS = {
  ...MOCK_FAMILY_BASE,
  members: [
    {
      userId: MOCK_USER.id,
      role: 'PARENT',
      joinedAt: new Date('2025-01-01'),
      user: { displayName: 'Thomas', avatarUrl: null },
    },
    {
      userId: MOCK_USER2.id,
      role: 'PARENT',
      joinedAt: new Date('2025-01-02'),
      user: { displayName: 'Marie', avatarUrl: null },
    },
  ],
};

const MOCK_MEMBERSHIP_WITH_FAMILY = {
  ...MOCK_MEMBER,
  family: MOCK_FAMILY_WITH_MEMBERS,
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('FamiliesService', () => {
  let service: FamiliesService;

  const mockPrisma = {
    family: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    familyMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamiliesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FamiliesService>(FamiliesService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (generateInviteCode as jest.Mock).mockReturnValue('ABCDEF');
    // $transaction executes the callback synchronously with mockPrisma as tx client
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ── createFamily ─────────────────────────────────────────────────────────────

  describe('createFamily', () => {
    it('throws ALREADY_IN_FAMILY when user is already in a family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBER);

      const error = await service
        .createFamily(MOCK_USER.id, { name: 'Famille Test' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'ALREADY_IN_FAMILY',
      });
      expect(mockPrisma.family.create).not.toHaveBeenCalled();
    });

    it('creates family with PARENT role and returns formatted family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);
      mockPrisma.family.findUnique.mockResolvedValue(null); // no inviteCode collision
      mockPrisma.family.create.mockResolvedValue(MOCK_FAMILY_WITH_MEMBERS);

      const result = await service.createFamily(MOCK_USER.id, {
        name: 'Les Moissonnier',
      });

      expect(mockPrisma.family.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inviteCode: 'ABCDEF',
            members: { create: { userId: MOCK_USER.id, role: 'PARENT' } },
          }),
        }),
      );
      expect(result.inviteCode).toBe('ABCDEF');
      expect(result.members[0].role).toBe('PARENT');
    });
  });

  // ── joinFamily ───────────────────────────────────────────────────────────────

  describe('joinFamily', () => {
    it('throws ALREADY_IN_FAMILY when user is already in a family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBER);

      const error = await service
        .joinFamily(MOCK_USER.id, { inviteCode: 'ABCDEF' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'ALREADY_IN_FAMILY',
      });
    });

    it('throws INVALID_INVITE_CODE when code is not found', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);
      mockPrisma.family.findUnique.mockResolvedValue(null); // code not found in tx

      const error = await service
        .joinFamily(MOCK_USER.id, { inviteCode: 'ZZZZZZ' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'INVALID_INVITE_CODE',
      });
    });

    it('creates CHILD membership and returns formatted family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);
      // Inside transaction: findUnique finds the family by inviteCode
      mockPrisma.family.findUnique.mockResolvedValue(MOCK_FAMILY_BASE);
      mockPrisma.familyMember.create.mockResolvedValue(MOCK_MEMBER);
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(
        MOCK_FAMILY_WITH_MEMBERS,
      );

      const result = await service.joinFamily(MOCK_USER.id, {
        inviteCode: 'ABCDEF',
      });

      expect(mockPrisma.familyMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: MOCK_USER.id,
            familyId: MOCK_FAMILY_BASE.id,
            role: 'CHILD',
          }),
        }),
      );
      expect(result.id).toBe(MOCK_FAMILY_BASE.id);
    });
  });

  // ── getMyFamily ───────────────────────────────────────────────────────────────

  describe('getMyFamily', () => {
    it('returns null when user is not in any family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      const result = await service.getMyFamily(MOCK_USER.id);

      expect(result).toBeNull();
    });

    it('returns formatted family with members', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(
        MOCK_MEMBERSHIP_WITH_FAMILY,
      );

      const result = await service.getMyFamily(MOCK_USER.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(MOCK_FAMILY_BASE.id);
      expect(result!.inviteCode).toBe('ABCDEF');
      expect(result!.members).toHaveLength(1);
      expect(result!.members[0]).toMatchObject({
        userId: MOCK_USER.id,
        displayName: 'Thomas',
        role: 'PARENT',
      });
    });
  });

  // ── regenerateInviteCode ──────────────────────────────────────────────────────

  describe('regenerateInviteCode', () => {
    it('throws FORBIDDEN_NOT_PARENT when user is not a parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        role: 'CHILD',
        family: MOCK_FAMILY_WITH_MEMBERS,
      });

      const error = await service
        .regenerateInviteCode(MOCK_USER.id)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_NOT_PARENT',
      });
      expect(mockPrisma.family.update).not.toHaveBeenCalled();
    });

    it('generates a new code and returns the full updated family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(
        MOCK_MEMBERSHIP_WITH_FAMILY,
      );
      mockPrisma.family.findUnique.mockResolvedValue(null); // no collision
      const updatedFamily = { ...MOCK_FAMILY_WITH_MEMBERS, inviteCode: 'ABCDEF' };
      mockPrisma.family.update.mockResolvedValue(updatedFamily);

      const result = await service.regenerateInviteCode(MOCK_USER.id);

      expect(mockPrisma.family.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_FAMILY_BASE.id },
          data: { inviteCode: 'ABCDEF' },
        }),
      );
      expect(result.members).toHaveLength(1);
    });
  });

  // ── leaveFamily ───────────────────────────────────────────────────────────────

  describe('leaveFamily', () => {
    it('throws NOT_IN_FAMILY when user is not in a family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      const error = await service.leaveFamily(MOCK_USER.id).catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'NOT_IN_FAMILY',
      });
    });

    it('throws LAST_PARENT_CANNOT_LEAVE when last parent with other members', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });

      const error = await service.leaveFamily(MOCK_USER.id).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'LAST_PARENT_CANNOT_LEAVE',
      });
    });

    it('deletes the family when the last member leaves', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(
        MOCK_MEMBERSHIP_WITH_FAMILY, // 1 member only
      );
      mockPrisma.familyMember.delete.mockResolvedValue(MOCK_MEMBER);
      mockPrisma.family.delete.mockResolvedValue(MOCK_FAMILY_BASE);

      await service.leaveFamily(MOCK_USER.id);

      expect(mockPrisma.familyMember.delete).toHaveBeenCalledWith({
        where: { userId_familyId: { userId: MOCK_USER.id, familyId: MOCK_FAMILY_BASE.id } },
      });
      expect(mockPrisma.family.delete).toHaveBeenCalledWith({
        where: { id: MOCK_FAMILY_BASE.id },
      });
    });

    it('removes membership without deleting family when other members remain (non-parent)', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER2,
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });
      mockPrisma.familyMember.delete.mockResolvedValue(MOCK_MEMBER2);

      await service.leaveFamily(MOCK_USER2.id);

      expect(mockPrisma.familyMember.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.family.delete).not.toHaveBeenCalled();
    });

    it('allows a parent to leave when another parent is present', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_PARENTS,
      });
      mockPrisma.familyMember.delete.mockResolvedValue(MOCK_MEMBER);

      await service.leaveFamily(MOCK_USER.id);

      expect(mockPrisma.familyMember.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.family.delete).not.toHaveBeenCalled();
    });
  });

  // ── kickMember ────────────────────────────────────────────────────────────────

  describe('kickMember', () => {
    it('throws FORBIDDEN_NOT_PARENT when caller is not a parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER2, // CHILD
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });

      const error = await service
        .kickMember(MOCK_USER2.id, MOCK_USER.id)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_NOT_PARENT',
      });
    });

    it('throws CANNOT_KICK_SELF when caller tries to kick themselves', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_MEMBERS,
      });

      const error = await service
        .kickMember(MOCK_USER.id, MOCK_USER.id)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'CANNOT_KICK_SELF',
      });
    });

    it('throws MEMBER_NOT_FOUND when target is not in the family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_MEMBERS, // only Thomas
      });

      const error = await service
        .kickMember(MOCK_USER.id, MOCK_USER2.id)
        .catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'MEMBER_NOT_FOUND',
      });
    });

    it('throws CANNOT_KICK_PARENT when trying to kick another parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_PARENTS,
      });

      const error = await service
        .kickMember(MOCK_USER.id, MOCK_USER2.id)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'CANNOT_KICK_PARENT',
      });
    });

    it('kicks a member and returns the updated family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });
      mockPrisma.familyMember.delete.mockResolvedValue(MOCK_MEMBER2);
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(
        MOCK_FAMILY_WITH_MEMBERS,
      );

      const result = await service.kickMember(MOCK_USER.id, MOCK_USER2.id);

      expect(mockPrisma.familyMember.delete).toHaveBeenCalledWith({
        where: {
          userId_familyId: {
            userId: MOCK_USER2.id,
            familyId: MOCK_FAMILY_BASE.id,
          },
        },
      });
      expect(result.members).toHaveLength(1);
    });

    it('kickMember last non-parent member → family intact, 1 parent remaining', async () => {
      // Family: Thomas (PARENT) + Marie (CHILD). Kick Marie.
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });
      mockPrisma.familyMember.delete.mockResolvedValue(MOCK_MEMBER2);
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(
        MOCK_FAMILY_WITH_MEMBERS, // only Thomas remains
      );

      const result = await service.kickMember(MOCK_USER.id, MOCK_USER2.id);

      expect(mockPrisma.familyMember.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.family.delete).not.toHaveBeenCalled();
      expect(result.members).toHaveLength(1);
      expect(result.members[0].role).toBe('PARENT');
    });
  });

  // ── changeMemberRole ──────────────────────────────────────────────────────────

  describe('changeMemberRole', () => {
    it('throws FORBIDDEN_NOT_PARENT when caller is not a parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER2, // CHILD
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });

      const error = await service
        .changeMemberRole(MOCK_USER2.id, MOCK_USER.id, { role: 'CHILD' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_NOT_PARENT',
      });
    });

    it('throws MEMBER_NOT_FOUND when target is not in the family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_MEMBERS, // only Thomas
      });

      const error = await service
        .changeMemberRole(MOCK_USER.id, MOCK_USER2.id, { role: 'PARENT' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'MEMBER_NOT_FOUND',
      });
    });

    it('throws LAST_PARENT_CANNOT_DEMOTE when demoting the only parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_MEMBERS, // Thomas=PARENT, Marie=CHILD
      });

      const error = await service
        .changeMemberRole(MOCK_USER.id, MOCK_USER.id, { role: 'CHILD' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'LAST_PARENT_CANNOT_DEMOTE',
      });
    });

    it('promotes a member to PARENT', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_MEMBERS, // Thomas=PARENT, Marie=CHILD
      });
      mockPrisma.familyMember.update.mockResolvedValue({
        ...MOCK_MEMBER2,
        role: 'PARENT',
      });
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(
        MOCK_FAMILY_WITH_TWO_PARENTS,
      );

      const result = await service.changeMemberRole(MOCK_USER.id, MOCK_USER2.id, {
        role: 'PARENT',
      });

      expect(mockPrisma.familyMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_familyId: {
              userId: MOCK_USER2.id,
              familyId: MOCK_FAMILY_BASE.id,
            },
          },
          data: { role: 'PARENT' },
        }),
      );
      expect(result.members.filter((m) => m.role === 'PARENT')).toHaveLength(2);
    });

    it('demotes one of two parents to CHILD', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER,
        family: MOCK_FAMILY_WITH_TWO_PARENTS, // both PARENT
      });
      mockPrisma.familyMember.update.mockResolvedValue({
        ...MOCK_MEMBER2,
        role: 'CHILD',
      });
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(
        MOCK_FAMILY_WITH_TWO_MEMBERS, // Thomas=PARENT, Marie=CHILD
      );

      const result = await service.changeMemberRole(MOCK_USER.id, MOCK_USER2.id, {
        role: 'CHILD',
      });

      expect(result.members.filter((m) => m.role === 'PARENT')).toHaveLength(1);
    });
  });

  // ── renameFamily ──────────────────────────────────────────────────────────────

  describe('renameFamily', () => {
    it('throws FORBIDDEN_NOT_PARENT when caller is not a parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER2, // CHILD
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });

      const error = await service
        .renameFamily(MOCK_USER2.id, { name: 'Nouveau Nom' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_NOT_PARENT',
      });
      expect(mockPrisma.family.update).not.toHaveBeenCalled();
    });

    it('renames the family and returns the updated family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(
        MOCK_MEMBERSHIP_WITH_FAMILY,
      );
      const renamed = { ...MOCK_FAMILY_WITH_MEMBERS, name: 'Les Dupont' };
      mockPrisma.family.update.mockResolvedValue(renamed);

      const result = await service.renameFamily(MOCK_USER.id, {
        name: 'Les Dupont',
      });

      expect(mockPrisma.family.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_FAMILY_BASE.id },
          data: { name: 'Les Dupont' },
        }),
      );
      expect(result.name).toBe('Les Dupont');
    });
  });

  // ── deleteFamily ──────────────────────────────────────────────────────────────

  describe('deleteFamily', () => {
    it('throws FORBIDDEN_NOT_PARENT when caller is not a parent', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        ...MOCK_MEMBER2, // CHILD
        family: MOCK_FAMILY_WITH_TWO_MEMBERS,
      });

      const error = await service
        .deleteFamily(MOCK_USER2.id, { confirmationName: 'Les Moissonnier' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_NOT_PARENT',
      });
      expect(mockPrisma.family.delete).not.toHaveBeenCalled();
    });

    it('throws CONFIRMATION_MISMATCH when name does not match', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(
        MOCK_MEMBERSHIP_WITH_FAMILY,
      );

      const error = await service
        .deleteFamily(MOCK_USER.id, { confirmationName: 'Mauvais Nom' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'CONFIRMATION_MISMATCH',
      });
      expect(mockPrisma.family.delete).not.toHaveBeenCalled();
    });

    it('deletes the family when name matches', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(
        MOCK_MEMBERSHIP_WITH_FAMILY,
      );
      mockPrisma.family.delete.mockResolvedValue(MOCK_FAMILY_BASE);

      await service.deleteFamily(MOCK_USER.id, {
        confirmationName: 'Les Moissonnier',
      });

      expect(mockPrisma.family.delete).toHaveBeenCalledWith({
        where: { id: MOCK_FAMILY_BASE.id },
      });
    });
  });

  // ── generateInviteCode util ───────────────────────────────────────────────────

  describe('generateInviteCode util', () => {
    it('returns 6 characters from the safe 32-char alphabet', () => {
      const { generateInviteCode: realFn } = jest.requireActual<
        typeof import('./utils/invite-code.util')
      >('./utils/invite-code.util');
      const code = realFn();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });
  });
});
