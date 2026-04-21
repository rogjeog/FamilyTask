import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const REQUESTER_ID = 'user-req-1';
const ASSIGNEE_ID = 'user-asg-1';
const OTHER_ID = 'user-oth-1';
const FAMILY_ID = 'family-id-1';
const TASK_ID = 'task-id-1';

const MOCK_MEMBERSHIP = { userId: REQUESTER_ID, familyId: FAMILY_ID, role: 'PARENT' };
const MOCK_ASSIGNEE_MEMBERSHIP = { userId: ASSIGNEE_ID, familyId: FAMILY_ID, role: 'CHILD' };

function makeTask(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    familyId: FAMILY_ID,
    requesterId: REQUESTER_ID,
    assigneeId: ASSIGNEE_ID,
    title: 'Faire la vaisselle',
    description: null,
    points: 10,
    dueAt: null,
    status,
    recurrenceRule: null,
    proofUrl: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    requester: { displayName: 'Thomas' },
    assignee: { displayName: 'Marie' },
    ...overrides,
  };
}

const MOCK_EVENT = {
  id: 'event-id-1',
  taskId: TASK_ID,
  actorId: REQUESTER_ID,
  fromStatus: null,
  toStatus: 'PENDING',
  note: null,
  createdAt: new Date('2025-01-01'),
  actor: { displayName: 'Thomas' },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('TasksService', () => {
  let service: TasksService;

  const mockPrisma = {
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    familyMember: {
      findFirst: jest.fn(),
    },
    taskEvent: {
      create: jest.fn(),
    },
    taskReminderConfig: {
      upsert: jest.fn(),
    },
    pointsLedger: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ── createTask ───────────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('throws CANNOT_SELF_ASSIGN when assigneeId equals callerId', async () => {
      const error = await service
        .createTask(REQUESTER_ID, {
          assigneeId: REQUESTER_ID,
          title: 'Test',
          points: 0,
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
        code: 'CANNOT_SELF_ASSIGN',
      });
      expect(mockPrisma.familyMember.findFirst).not.toHaveBeenCalled();
    });

    it('throws INVALID_DUE_DATE when dueAt is in the past', async () => {
      const error = await service
        .createTask(REQUESTER_ID, {
          assigneeId: ASSIGNEE_ID,
          title: 'Test',
          points: 0,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'INVALID_DUE_DATE',
      });
    });

    it('throws TASK_NOT_ACCESSIBLE when assignee is not in the family', async () => {
      // First findFirst: caller membership (exists)
      // Second findFirst: assignee membership (not found)
      mockPrisma.familyMember.findFirst
        .mockResolvedValueOnce(MOCK_MEMBERSHIP)
        .mockResolvedValueOnce(null);

      const error = await service
        .createTask(REQUESTER_ID, {
          assigneeId: ASSIGNEE_ID,
          title: 'Test',
          points: 5,
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'TASK_NOT_ACCESSIBLE',
      });
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });

    it('creates task and returns formatted task', async () => {
      mockPrisma.familyMember.findFirst
        .mockResolvedValueOnce(MOCK_MEMBERSHIP)
        .mockResolvedValueOnce(MOCK_ASSIGNEE_MEMBERSHIP);
      mockPrisma.task.create.mockResolvedValue(makeTask('PENDING'));

      const result = await service.createTask(REQUESTER_ID, {
        assigneeId: ASSIGNEE_ID,
        title: 'Faire la vaisselle',
        points: 10,
      });

      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: FAMILY_ID,
            requesterId: REQUESTER_ID,
            assigneeId: ASSIGNEE_ID,
            title: 'Faire la vaisselle',
            points: 10,
          }),
        }),
      );
      expect(result.status).toBe('PENDING');
      expect(result.requesterName).toBe('Thomas');
    });
  });

  // ── updateTask ───────────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the requester', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .updateTask(ASSIGNEE_ID, TASK_ID, { title: 'Nouveau titre' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
    });

    it('throws INVALID_TRANSITION when status is not PENDING', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .updateTask(REQUESTER_ID, TASK_ID, { title: 'Nouveau titre' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });

    it('updates task and returns updated task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(makeTask('PENDING', { title: 'Nouveau titre' }));

      const result = await service.updateTask(REQUESTER_ID, TASK_ID, {
        title: 'Nouveau titre',
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TASK_ID } }),
      );
      expect(result.title).toBe('Nouveau titre');
    });
  });

  // ── deleteTask ───────────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the requester', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .deleteTask(ASSIGNEE_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
    });

    it('throws INVALID_TRANSITION when status is not PENDING', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .deleteTask(REQUESTER_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });

    it('deletes task successfully', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.delete.mockResolvedValue(makeTask('PENDING'));

      await service.deleteTask(REQUESTER_ID, TASK_ID);

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({
        where: { id: TASK_ID },
      });
    });
  });

  // ── acceptTask ───────────────────────────────────────────────────────────────

  describe('acceptTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the assignee', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .acceptTask(REQUESTER_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
    });

    it('throws INVALID_TRANSITION when status is not PENDING', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .acceptTask(ASSIGNEE_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });

    it('transitions to ACCEPTED and creates TaskEvent', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.taskEvent.create.mockResolvedValue(MOCK_EVENT);

      const result = await service.acceptTask(ASSIGNEE_ID, TASK_ID);

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACCEPTED' } }),
      );
      expect(mockPrisma.taskEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'PENDING',
            toStatus: 'ACCEPTED',
            actorId: ASSIGNEE_ID,
          }),
        }),
      );
      expect(result.status).toBe('ACCEPTED');
    });
  });

  // ── rejectTask ───────────────────────────────────────────────────────────────

  describe('rejectTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the assignee', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .rejectTask(REQUESTER_ID, TASK_ID, {})
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
    });

    it('throws INVALID_TRANSITION when status is not PENDING', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .rejectTask(ASSIGNEE_ID, TASK_ID, {})
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
    });

    it('transitions to REJECTED and stores reason in event note', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(makeTask('REJECTED'));
      mockPrisma.taskEvent.create.mockResolvedValue(MOCK_EVENT);

      const result = await service.rejectTask(ASSIGNEE_ID, TASK_ID, {
        reason: 'Tâche trop difficile',
      });

      expect(mockPrisma.taskEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toStatus: 'REJECTED',
            note: 'Tâche trop difficile',
          }),
        }),
      );
      expect(result.status).toBe('REJECTED');
    });
  });

  // ── completeTask ─────────────────────────────────────────────────────────────

  describe('completeTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the assignee', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .completeTask(REQUESTER_ID, TASK_ID, {})
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
    });

    it('throws INVALID_TRANSITION when status is not ACCEPTED', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .completeTask(ASSIGNEE_ID, TASK_ID, {})
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });

    it('transitions to COMPLETED and stores proofUrl', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(
        makeTask('COMPLETED', { proofUrl: 'https://example.com/proof.jpg' }),
      );
      mockPrisma.taskEvent.create.mockResolvedValue(MOCK_EVENT);

      const result = await service.completeTask(ASSIGNEE_ID, TASK_ID, {
        proofUrl: 'https://example.com/proof.jpg',
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            proofUrl: 'https://example.com/proof.jpg',
          }),
        }),
      );
      expect(result.status).toBe('COMPLETED');
      expect(result.proofUrl).toBe('https://example.com/proof.jpg');
    });
  });

  // ── validateTask ─────────────────────────────────────────────────────────────

  describe('validateTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the requester', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('COMPLETED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .validateTask(ASSIGNEE_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
    });

    it('throws INVALID_TRANSITION when status is not COMPLETED', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .validateTask(REQUESTER_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
    });

    it('transitions to REWARDED and creates TaskEvent + PointsLedger', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('COMPLETED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(makeTask('REWARDED'));
      mockPrisma.taskEvent.create.mockResolvedValue(MOCK_EVENT);
      mockPrisma.pointsLedger.create.mockResolvedValue({ id: 'ledger-1' });

      const result = await service.validateTask(REQUESTER_ID, TASK_ID);

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'REWARDED' } }),
      );
      expect(mockPrisma.taskEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'COMPLETED',
            toStatus: 'REWARDED',
          }),
        }),
      );
      expect(mockPrisma.pointsLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: ASSIGNEE_ID,
            delta: 10,
            reason: 'TASK_VALIDATED',
          }),
        }),
      );
      expect(result.status).toBe('REWARDED');
    });

    it('does not create PointsLedger entry when points === 0', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('COMPLETED', { points: 0 }));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(makeTask('REWARDED', { points: 0 }));
      mockPrisma.taskEvent.create.mockResolvedValue(MOCK_EVENT);

      await service.validateTask(REQUESTER_ID, TASK_ID);

      expect(mockPrisma.pointsLedger.create).not.toHaveBeenCalled();
    });

    it('assignee cannot validate their own task (defense in depth)', async () => {
      // assigneeId tries to validate — but requesterId !== assigneeId
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('COMPLETED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .validateTask(ASSIGNEE_ID, TASK_ID)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── disputeTask ──────────────────────────────────────────────────────────────

  describe('disputeTask', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the requester', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('COMPLETED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);

      const error = await service
        .disputeTask(ASSIGNEE_ID, TASK_ID, { reason: 'Pas fait correctement' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
    });

    it('throws INVALID_TRANSITION when status is not COMPLETED', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .disputeTask(REQUESTER_ID, TASK_ID, { reason: 'Test' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
    });

    it('throws INVALID_TRANSITION when task is REWARDED (terminal state)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('REWARDED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .disputeTask(REQUESTER_ID, TASK_ID, { reason: 'Trop tard' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });

    it('reverts to ACCEPTED and records reason in event', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('COMPLETED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.update.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.taskEvent.create.mockResolvedValue(MOCK_EVENT);

      const result = await service.disputeTask(REQUESTER_ID, TASK_ID, {
        reason: 'La vaisselle était encore sale',
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
      );
      expect(mockPrisma.taskEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'COMPLETED',
            toStatus: 'ACCEPTED',
            note: 'La vaisselle était encore sale',
          }),
        }),
      );
      expect(result.status).toBe('ACCEPTED');
    });
  });

  // ── setReminders ─────────────────────────────────────────────────────────────

  describe('setReminders', () => {
    it('throws FORBIDDEN_WRONG_ROLE when caller is not the assignee', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('PENDING'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const error = await service
        .setReminders(REQUESTER_ID, TASK_ID, { offsetsMinutes: [60] })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN_WRONG_ROLE',
      });
    });

    it('upserts reminder config (empty array allowed)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);
      mockPrisma.taskReminderConfig.upsert.mockResolvedValue({
        id: 'rc-1',
        userId: ASSIGNEE_ID,
        taskId: TASK_ID,
        offsetsMinutes: [],
      });

      await service.setReminders(ASSIGNEE_ID, TASK_ID, { offsetsMinutes: [] });

      expect(mockPrisma.taskReminderConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_taskId: { userId: ASSIGNEE_ID, taskId: TASK_ID } },
          update: { offsetsMinutes: [] },
          create: { userId: ASSIGNEE_ID, taskId: TASK_ID, offsetsMinutes: [] },
        }),
      );
    });

    it('saves offsets and returns config', async () => {
      const offsets = [60, 120, 1440];
      mockPrisma.task.findUnique.mockResolvedValue(makeTask('ACCEPTED'));
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_ASSIGNEE_MEMBERSHIP);
      mockPrisma.taskReminderConfig.upsert.mockResolvedValue({
        id: 'rc-1',
        userId: ASSIGNEE_ID,
        taskId: TASK_ID,
        offsetsMinutes: offsets,
      });

      const result = await service.setReminders(ASSIGNEE_ID, TASK_ID, {
        offsetsMinutes: offsets,
      });

      expect(result.offsetsMinutes).toEqual(offsets);
    });
  });

  // ── listTasks ────────────────────────────────────────────────────────────────

  describe('listTasks', () => {
    it('throws NOT_IN_FAMILY when user is not in a family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      const error = await service.listTasks(REQUESTER_ID, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'NOT_IN_FAMILY',
      });
    });

    it('returns tasks scoped to the family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.findMany.mockResolvedValue([makeTask('PENDING')]);

      const result = await service.listTasks(REQUESTER_ID, {});

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ familyId: FAMILY_ID }),
        }),
      );
      expect(result.tasks).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('filters by status', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      mockPrisma.task.findMany.mockResolvedValue([makeTask('PENDING')]);

      await service.listTasks(REQUESTER_ID, { status: ['PENDING'] as any });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING'] },
          }),
        }),
      );
    });

    it('returns nextCursor when there are more items', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);
      // limit=1, return 2 items → hasNext=true
      const tasks = [makeTask('PENDING'), makeTask('ACCEPTED', { id: 'task-id-2' })];
      mockPrisma.task.findMany.mockResolvedValue(tasks);

      const result = await service.listTasks(REQUESTER_ID, { limit: 1 });

      expect(result.tasks).toHaveLength(1);
      expect(result.nextCursor).toBe(TASK_ID);
    });
  });

  // ── getTask ──────────────────────────────────────────────────────────────────

  describe('getTask', () => {
    it('throws TASK_NOT_FOUND when task does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const error = await service
        .getTask(REQUESTER_ID, 'nonexistent-id')
        .catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });

    it('returns task with events', async () => {
      const taskWithEvents = { ...makeTask('ACCEPTED'), events: [MOCK_EVENT] };
      mockPrisma.task.findUnique.mockResolvedValue(taskWithEvents);
      mockPrisma.familyMember.findFirst.mockResolvedValue(MOCK_MEMBERSHIP);

      const result = await service.getTask(REQUESTER_ID, TASK_ID);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].toStatus).toBe('PENDING');
      expect(result.events[0].actorName).toBe('Thomas');
    });
  });
});
