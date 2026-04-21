'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { updateTask } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/client';
import type { Task } from '@/lib/api/types';

const schema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().max(2000).optional(),
  points: z.coerce.number().int().min(0).max(10000),
  dueAt: z.string().optional(),
});

type Values = z.infer<typeof schema>;

interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTaskDialog({ task, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      points: task.points,
      dueAt: toDatetimeLocal(task.dueAt),
    },
  });

  async function onSubmit(data: Values) {
    try {
      const updated = await updateTask(task.id, {
        title: data.title,
        description: data.description || undefined,
        points: data.points,
        dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : null,
      });
      queryClient.setQueryData<Task>(['task', task.id], (prev) =>
        prev ? { ...prev, ...updated } : updated,
      );
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      toast.success('Tâche modifiée.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_DUE_DATE') {
        form.setError('dueAt', { message: "La date doit être dans le futur" });
      } else if (err instanceof ApiError && err.code === 'INVALID_TRANSITION') {
        toast.error('Cette tâche ne peut plus être modifiée.');
        onOpenChange(false);
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la tâche</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={10000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Échéance (optionnel)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
