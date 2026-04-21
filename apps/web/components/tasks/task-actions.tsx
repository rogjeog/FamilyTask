'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Pencil, Trash2, Flag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { EditTaskDialog } from './edit-task-dialog';
import {
  acceptTask,
  rejectTask,
  completeTask,
  validateTask,
  disputeTask,
  deleteTask,
} from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/client';
import type { Task, TaskWithEvents } from '@/lib/api/types';

interface Props {
  task: TaskWithEvents;
  currentUserId: string;
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});
type RejectValues = z.infer<typeof rejectSchema>;

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason?: string) => void;
  isPending: boolean;
}) {
  const form = useForm<RejectValues>({ resolver: zodResolver(rejectSchema), defaultValues: { reason: '' } });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) form.reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Refuser la tâche</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => onConfirm(d.reason || undefined))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Explique pourquoi..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                Refuser
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Complete dialog ──────────────────────────────────────────────────────────

const completeSchema = z.object({
  proofUrl: z.string().url('URL invalide').optional().or(z.literal('')),
});
type CompleteValues = z.infer<typeof completeSchema>;

function CompleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (proofUrl?: string) => void;
  isPending: boolean;
}) {
  const form = useForm<CompleteValues>({ resolver: zodResolver(completeSchema), defaultValues: { proofUrl: '' } });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) form.reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Marquer la tâche comme terminée</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => onConfirm(d.proofUrl || undefined))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="proofUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lien de preuve (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Tu peux coller un lien vers une photo (Google Photos, iCloud, etc.)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                Marquer terminée
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dispute dialog ───────────────────────────────────────────────────────────

const disputeSchema = z.object({
  reason: z.string().min(1, 'La raison est requise').max(500),
});
type DisputeValues = z.infer<typeof disputeSchema>;

function DisputeDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const form = useForm<DisputeValues>({ resolver: zodResolver(disputeSchema), defaultValues: { reason: '' } });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) form.reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Contester la tâche</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => onConfirm(d.reason))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison de la contestation</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explique pourquoi la tâche n'est pas correctement accomplie..."
                      rows={3}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                Contester
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main TaskActions component ───────────────────────────────────────────────

export function TaskActions({ task, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const isRequester = task.requesterId === currentUserId;
  const isAssignee = task.assigneeId === currentUserId;

  function applyUpdate(updated: Task) {
    queryClient.setQueryData<TaskWithEvents>(['task', task.id], (prev) =>
      prev ? { ...prev, ...updated } : { ...updated, events: task.events },
    );
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleAccept() {
    setIsPending(true);
    try {
      const updated = await acceptTask(task.id);
      applyUpdate(updated);
      toast.success('Tâche acceptée.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_TRANSITION') {
        toast.error('Action impossible depuis ce statut.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleReject(reason?: string) {
    setIsPending(true);
    try {
      const updated = await rejectTask(task.id, { reason });
      applyUpdate(updated);
      setRejectOpen(false);
      toast.success('Tâche refusée.');
    } catch (err) {
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsPending(false);
    }
  }

  async function handleComplete(proofUrl?: string) {
    setIsPending(true);
    try {
      const updated = await completeTask(task.id, { proofUrl });
      applyUpdate(updated);
      setCompleteOpen(false);
      toast.success('Tâche marquée comme terminée !');
    } catch (err) {
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsPending(false);
    }
  }

  async function handleValidate() {
    setIsPending(true);
    try {
      const updated = await validateTask(task.id);
      applyUpdate(updated);
      setValidateOpen(false);
      toast.success(`Tâche validée ! ${task.points > 0 ? `+${task.points} pts pour ${task.assigneeName}` : ''}`);
    } catch (err) {
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsPending(false);
    }
  }

  async function handleDispute(reason: string) {
    setIsPending(true);
    try {
      const updated = await disputeTask(task.id, { reason });
      applyUpdate(updated);
      setDisputeOpen(false);
      toast.success('Tâche contestée — elle est retournée à l\'assigné.');
    } catch (err) {
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    setIsPending(true);
    try {
      await deleteTask(task.id);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tâche supprimée.');
      router.replace('/tasks');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_TRANSITION') {
        toast.error('Cette tâche ne peut plus être supprimée.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
      setIsPending(false);
      setDeleteOpen(false);
    }
  }

  // ── PENDING + assignee ────────────────────────────────────────────────────
  if (task.status === 'PENDING' && isAssignee) {
    return (
      <div className="flex gap-3 flex-wrap">
        <Button onClick={handleAccept} disabled={isPending}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Accepter
        </Button>
        <Button
          variant="outline"
          onClick={() => setRejectOpen(true)}
          disabled={isPending}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Refuser
        </Button>

        <RejectDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onConfirm={handleReject}
          isPending={isPending}
        />
      </div>
    );
  }

  // ── PENDING + requester ───────────────────────────────────────────────────
  if (task.status === 'PENDING' && isRequester) {
    return (
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Modifier
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="text-accent hover:text-accent"
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Supprimer
        </Button>

        <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la tâche ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── ACCEPTED + assignee ───────────────────────────────────────────────────
  if (task.status === 'ACCEPTED' && isAssignee) {
    return (
      <div className="flex gap-3">
        <Button onClick={() => setCompleteOpen(true)} disabled={isPending}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Marquer terminée
        </Button>

        <CompleteDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          onConfirm={handleComplete}
          isPending={isPending}
        />
      </div>
    );
  }

  // ── COMPLETED + requester ─────────────────────────────────────────────────
  if (task.status === 'COMPLETED' && isRequester) {
    return (
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => setValidateOpen(true)} disabled={isPending}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Valider{task.points > 0 ? ` (+${task.points} pts)` : ''}
        </Button>
        <Button
          variant="outline"
          onClick={() => setDisputeOpen(true)}
          disabled={isPending}
        >
          <Flag className="h-4 w-4 mr-2" />
          Contester
        </Button>

        <AlertDialog open={validateOpen} onOpenChange={setValidateOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Valider la tâche ?</AlertDialogTitle>
              <AlertDialogDescription>
                {task.points > 0
                  ? `${task.assigneeName} recevra ${task.points} point${task.points > 1 ? 's' : ''}.`
                  : 'La tâche sera marquée comme complétée.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleValidate} disabled={isPending}>
                Valider
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DisputeDialog
          open={disputeOpen}
          onOpenChange={setDisputeOpen}
          onConfirm={handleDispute}
          isPending={isPending}
        />
      </div>
    );
  }

  // ── Terminal states ───────────────────────────────────────────────────────
  if (task.status === 'REWARDED') {
    return (
      <p className="text-sm text-success font-medium">
        ✓ Validée — {task.points > 0 ? `+${task.points} pts crédités à ${task.assigneeName}` : 'Tâche complétée'}
      </p>
    );
  }

  if (task.status === 'REJECTED') {
    return (
      <p className="text-sm text-accent font-medium">
        ✗ Refusée par {task.assigneeName}
      </p>
    );
  }

  return null;
}
