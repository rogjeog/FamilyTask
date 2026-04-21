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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTask } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/client';
import type { FamilyMember } from '@/lib/api/types';

const schema = z.object({
  assigneeId: z.string().min(1, "Sélectionne un assigné"),
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().max(2000).optional(),
  points: z.coerce.number().int().min(0).max(10000),
  dueAt: z.string().optional(),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMember[];
  currentUserId: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  members,
  currentUserId,
}: Props) {
  const queryClient = useQueryClient();
  const assignableMembers = members.filter((m) => m.userId !== currentUserId);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { assigneeId: '', title: '', description: '', points: 0 },
  });

  async function onSubmit(data: Values) {
    try {
      await createTask({
        assigneeId: data.assigneeId,
        title: data.title,
        description: data.description || undefined,
        points: data.points,
        dueAt: data.dueAt ? new Date(data.dueAt).toISOString() : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      form.reset();
      toast.success('Tâche créée !');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CANNOT_SELF_ASSIGN') {
        toast.error('Vous ne pouvez pas vous assigner une tâche à vous-même.');
      } else if (err instanceof ApiError && err.code === 'INVALID_DUE_DATE') {
        form.setError('dueAt', { message: "La date doit être dans le futur" });
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigné à</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un membre..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assignableMembers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input placeholder="Faire la vaisselle" autoFocus {...field} />
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
                    <Textarea
                      placeholder="Détails supplémentaires..."
                      rows={3}
                      {...field}
                    />
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
                Créer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
