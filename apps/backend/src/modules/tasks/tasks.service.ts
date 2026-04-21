import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { DisputeTaskDto } from './dto/dispute-task.dto';
import { ReminderConfigDto } from './dto/reminder-config.dto';
import { ListTasksQuery } from './dto/list-tasks.query';

// ─── Shared includes ──────────────────────────────────────────────────────────

const TASK_INCLUDE = {
  requester: { select: { displayName: true } },
  assignee: { select: { displayName: true } },
} as const;

const TASK_WITH_EVENTS_INCLUDE = {
  ...TASK_INCLUDE,
  events: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { displayName: true } } },
  },
} as const;

// ─── Row types ────────────────────────────────────────────────────────────────

type TaskRow = {
  id: string;
  familyId: string;
  requesterId: string;
  assigneeId: string;
  title: string;
  description: string | null;
  points: number;
  dueAt: Date | null;
  status: string;
  recurrenceRule: string | null;
  proofUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  requester: { displayName: string };
  assignee: { displayName: string };
};

type TaskEventRow = {
  id: string;
  taskId: string;
  actorId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: Date;
  actor: { displayName: string };
};

type TaskWithEventsRow = TaskRow & { events: TaskEventRow[] };

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  private formatTask(task: TaskRow) {
    return {
      id: task.id,
      familyId: task.familyId,
      requesterId: task.requesterId,
      requesterName: task.requester.displayName,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee.displayName,
      title: task.title,
      description: task.description,
      points: task.points,
      dueAt: task.dueAt?.toISOString() ?? null,
      status: task.status as TaskStatus,
      recurrenceRule: task.recurrenceRule,
      proofUrl: task.proofUrl,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private formatTaskWithEvents(task: TaskWithEventsRow) {
    return {
      ...this.formatTask(task),
      events: task.events.map((e) => ({
        id: e.id,
        taskId: e.taskId,
        actorId: e.actorId,
        actorName: e.actor.displayName,
        fromStatus: e.fromStatus as TaskStatus | null,
        toStatus: e.toStatus as TaskStatus,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private async getTaskOrThrow(taskId: string): Promise<TaskRow> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: TASK_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Tâche introuvable',
      });
    }
    return task as TaskRow;
  }

  private async assertFamilyMembership(
    userId: string,
    familyId: string,
  ): Promise<void> {
    const membership = await this.prisma.familyMember.findFirst({
      where: { userId, familyId },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'TASK_NOT_ACCESSIBLE',
        message: "Vous n'avez pas accès à cette tâche",
      });
    }
  }

  private assertCanAct(
    userId: string,
    task: { requesterId: string; assigneeId: string; status: string },
    role: 'requester' | 'assignee',
    validStatuses: string[],
    actionLabel: string,
  ): void {
    if (!validStatuses.includes(task.status)) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Impossible de ${actionLabel} depuis le statut ${task.status}`,
      });
    }
    const expectedId =
      role === 'requester' ? task.requesterId : task.assigneeId;
    if (userId !== expectedId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_WRONG_ROLE',
        message:
          role === 'requester'
            ? 'Seul le demandeur peut effectuer cette action'
            : "Seul l'assigné peut effectuer cette action",
      });
    }
  }

  // ─── Public methods ──────────────────────────────────────────────────────────

  async listTasks(userId: string, query: ListTasksQuery) {
    const membership = await this.prisma.familyMember.findFirst({
      where: { userId },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_IN_FAMILY',
        message: "Vous n'êtes pas dans une famille",
      });
    }

    const limit = Math.min(query.limit ?? 20, 50);

    const tasks = await this.prisma.task.findMany({
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      where: {
        familyId: membership.familyId,
        ...(query.status?.length ? { status: { in: query.status } } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(query.requesterId ? { requesterId: query.requesterId } : {}),
        ...(query.dueAtFrom || query.dueAtTo
          ? {
              dueAt: {
                ...(query.dueAtFrom ? { gte: new Date(query.dueAtFrom) } : {}),
                ...(query.dueAtTo ? { lte: new Date(query.dueAtTo) } : {}),
              },
            }
          : {}),
      },
      include: TASK_INCLUDE,
    });

    const hasNext = tasks.length > limit;
    const items = hasNext ? tasks.slice(0, limit) : tasks;
    const nextCursor = hasNext ? items[items.length - 1].id : null;

    return {
      tasks: items.map((t) => this.formatTask(t as TaskRow)),
      nextCursor,
    };
  }

  async getTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: TASK_WITH_EVENTS_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Tâche introuvable',
      });
    }
    await this.assertFamilyMembership(userId, task.familyId);
    return this.formatTaskWithEvents(task as TaskWithEventsRow);
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    if (dto.assigneeId === userId) {
      throw new UnprocessableEntityException({
        code: 'CANNOT_SELF_ASSIGN',
        message: "Vous ne pouvez pas vous assigner une tâche à vous-même",
      });
    }

    if (dto.dueAt && new Date(dto.dueAt) <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_DUE_DATE',
        message: "La date d'échéance doit être dans le futur",
      });
    }

    const callerMembership = await this.prisma.familyMember.findFirst({
      where: { userId },
    });
    if (!callerMembership) {
      throw new ForbiddenException({
        code: 'NOT_IN_FAMILY',
        message: "Vous n'êtes pas dans une famille",
      });
    }

    const assigneeMembership = await this.prisma.familyMember.findFirst({
      where: { userId: dto.assigneeId, familyId: callerMembership.familyId },
    });
    if (!assigneeMembership) {
      throw new ForbiddenException({
        code: 'TASK_NOT_ACCESSIBLE',
        message: "L'assigné n'est pas membre de votre famille",
      });
    }

    const task = await this.prisma.task.create({
      data: {
        familyId: callerMembership.familyId,
        requesterId: userId,
        assigneeId: dto.assigneeId,
        title: dto.title,
        description: dto.description,
        points: dto.points,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        recurrenceRule: dto.recurrenceRule,
      },
      include: TASK_INCLUDE,
    });

    return this.formatTask(task as TaskRow);
  }

  async updateTask(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'requester', ['PENDING'], 'modifier');

    if (dto.dueAt && new Date(dto.dueAt) <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_DUE_DATE',
        message: "La date d'échéance doit être dans le futur",
      });
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.points !== undefined ? { points: dto.points } : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
          : {}),
        ...(dto.recurrenceRule !== undefined
          ? { recurrenceRule: dto.recurrenceRule }
          : {}),
      },
      include: TASK_INCLUDE,
    });

    return this.formatTask(updated as TaskRow);
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'requester', ['PENDING'], 'supprimer');
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  async acceptTask(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'assignee', ['PENDING'], 'accepter');

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId },
        data: { status: 'ACCEPTED' },
        include: TASK_INCLUDE,
      });
      await tx.taskEvent.create({
        data: {
          taskId,
          actorId: userId,
          fromStatus: 'PENDING',
          toStatus: 'ACCEPTED',
        },
      });
      return t;
    });

    return this.formatTask(updated as TaskRow);
  }

  async rejectTask(userId: string, taskId: string, dto: RejectTaskDto) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'assignee', ['PENDING'], 'refuser');

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId },
        data: { status: 'REJECTED' },
        include: TASK_INCLUDE,
      });
      await tx.taskEvent.create({
        data: {
          taskId,
          actorId: userId,
          fromStatus: 'PENDING',
          toStatus: 'REJECTED',
          note: dto.reason ?? null,
        },
      });
      return t;
    });

    return this.formatTask(updated as TaskRow);
  }

  async completeTask(userId: string, taskId: string, dto: CompleteTaskDto) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'assignee', ['ACCEPTED'], 'marquer terminée');

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          proofUrl: dto.proofUrl ?? null,
        },
        include: TASK_INCLUDE,
      });
      await tx.taskEvent.create({
        data: {
          taskId,
          actorId: userId,
          fromStatus: 'ACCEPTED',
          toStatus: 'COMPLETED',
          note: dto.proofUrl ?? null,
        },
      });
      return t;
    });

    return this.formatTask(updated as TaskRow);
  }

  async validateTask(userId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'requester', ['COMPLETED'], 'valider');

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId },
        data: { status: 'REWARDED' },
        include: TASK_INCLUDE,
      });
      await tx.taskEvent.create({
        data: {
          taskId,
          actorId: userId,
          fromStatus: 'COMPLETED',
          toStatus: 'REWARDED',
        },
      });
      if (t.points > 0) {
        await tx.pointsLedger.create({
          data: {
            userId: t.assigneeId,
            delta: t.points,
            reason: 'TASK_VALIDATED',
            relatedTaskId: taskId,
          },
        });
      }
      return t;
    });

    return this.formatTask(updated as TaskRow);
  }

  async disputeTask(userId: string, taskId: string, dto: DisputeTaskDto) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);
    this.assertCanAct(userId, task, 'requester', ['COMPLETED'], 'contester');

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId },
        data: { status: 'ACCEPTED' },
        include: TASK_INCLUDE,
      });
      await tx.taskEvent.create({
        data: {
          taskId,
          actorId: userId,
          fromStatus: 'COMPLETED',
          toStatus: 'ACCEPTED',
          note: dto.reason,
        },
      });
      return t;
    });

    return this.formatTask(updated as TaskRow);
  }

  async setReminders(userId: string, taskId: string, dto: ReminderConfigDto) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertFamilyMembership(userId, task.familyId);

    if (userId !== task.assigneeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_WRONG_ROLE',
        message: "Seul l'assigné peut configurer ses rappels",
      });
    }

    return this.prisma.taskReminderConfig.upsert({
      where: { userId_taskId: { userId, taskId } },
      update: { offsetsMinutes: dto.offsetsMinutes },
      create: { userId, taskId, offsetsMinutes: dto.offsetsMinutes },
    });
  }
}
