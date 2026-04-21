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
    },
    familyMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
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
      mockPrisma.familyMember.findUnique.mockResolvedValue({
        ...MOCK_MEMBER,
        role: 'CHILD',
      });

      const error = await service
        .regenerateInviteCode(MOCK_USER.id, MOCK_FAMILY_BASE.id)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_NOT_PARENT',
      });
      expect(mockPrisma.family.update).not.toHaveBeenCalled();
    });

    it('generates a new code and returns the full updated family', async () => {
      mockPrisma.familyMember.findUnique.mockResolvedValue(MOCK_MEMBER); // PARENT
      mockPrisma.family.findUnique.mockResolvedValue(null); // no collision
      const updatedFamily = {
        ...MOCK_FAMILY_WITH_MEMBERS,
        inviteCode: 'ABCDEF',
      };
      mockPrisma.family.update.mockResolvedValue(updatedFamily);

      const result = await service.regenerateInviteCode(
        MOCK_USER.id,
        MOCK_FAMILY_BASE.id,
      );

      expect(mockPrisma.family.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_FAMILY_BASE.id },
          data: { inviteCode: 'ABCDEF' },
        }),
      );
      expect(result.members).toHaveLength(1);
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
