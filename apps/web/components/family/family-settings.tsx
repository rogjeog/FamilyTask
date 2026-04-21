'use client';

import { useState } from 'react';
import { Settings2, LogOut, Pencil, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { renameFamily, leaveFamily, deleteFamily } from '@/lib/api/families';
import { ApiError } from '@/lib/api/client';
import type { Family } from '@/lib/api/types';

interface Props {
  family: Family;
  isParent: boolean;
}

const renameSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(60, 'Maximum 60 caractères'),
});

const deleteSchema = z.object({
  confirmationName: z.string().min(1, 'Ce champ est requis'),
});

type RenameValues = z.infer<typeof renameSchema>;
type DeleteValues = z.infer<typeof deleteSchema>;

export function FamilySettings({ family, isParent }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [renameOpen, setRenameOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isLeavePending, setIsLeavePending] = useState(false);

  const renameForm = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: family.name },
  });

  const deleteForm = useForm<DeleteValues>({
    resolver: zodResolver(deleteSchema),
    defaultValues: { confirmationName: '' },
  });

  async function handleRename(data: RenameValues) {
    try {
      const updated = await renameFamily({ name: data.name });
      queryClient.setQueryData<Family>(['family'], updated);
      setRenameOpen(false);
      renameForm.reset({ name: updated.name });
      toast.success('Famille renommée.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FORBIDDEN_NOT_PARENT') {
        toast.error('Vous n\'avez pas les droits nécessaires.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  async function handleLeave() {
    setIsLeavePending(true);
    try {
      await leaveFamily();
      queryClient.removeQueries({ queryKey: ['family'] });
      toast.success('Vous avez quitté la famille.');
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LAST_PARENT_CANNOT_LEAVE') {
        toast.error(
          'Vous êtes le seul parent. Promouvez un membre avant de quitter.',
        );
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
      setIsLeavePending(false);
      setLeaveOpen(false);
    }
  }

  async function handleDelete(data: DeleteValues) {
    try {
      await deleteFamily({ confirmationName: data.confirmationName });
      queryClient.removeQueries({ queryKey: ['family'] });
      toast.success('Famille supprimée.');
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFIRMATION_MISMATCH') {
        deleteForm.setError('confirmationName', {
          message: 'Le nom ne correspond pas',
        });
      } else if (err instanceof ApiError && err.code === 'FORBIDDEN_NOT_PARENT') {
        toast.error('Vous n\'avez pas les droits nécessaires.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Paramètres de la famille"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isParent && (
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Renommer la famille
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setLeaveOpen(true)}>
            <LogOut className="h-4 w-4 mr-2" />
            Quitter la famille
          </DropdownMenuItem>
          {isParent && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => {
                  deleteForm.reset({ confirmationName: '' });
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer la famille
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) renameForm.reset({ name: family.name });
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renommer la famille</DialogTitle>
          </DialogHeader>
          <Form {...renameForm}>
            <form
              onSubmit={renameForm.handleSubmit(handleRename)}
              className="space-y-4"
            >
              <FormField
                control={renameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau nom</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRenameOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={renameForm.formState.isSubmitting}
                >
                  Renommer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Leave confirmation */}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter la famille ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous perdrez l&apos;accès à la famille {family.name} et à ses
              tâches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} disabled={isLeavePending}>
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) deleteForm.reset({ confirmationName: '' });
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la famille</DialogTitle>
          </DialogHeader>
          <Form {...deleteForm}>
            <form
              onSubmit={deleteForm.handleSubmit(handleDelete)}
              className="space-y-4"
            >
              <p className="text-sm text-text-secondary">
                Cette action est irréversible. Tapez{' '}
                <span className="font-semibold text-text-primary">
                  {family.name}
                </span>{' '}
                pour confirmer.
              </p>
              <FormField
                control={deleteForm.control}
                name="confirmationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la famille</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder={family.name} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deleteForm.formState.isSubmitting}
                >
                  Supprimer définitivement
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
