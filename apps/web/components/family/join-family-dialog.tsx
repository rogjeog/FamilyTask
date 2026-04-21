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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { joinFamily } from '@/lib/api/families';
import { ApiError } from '@/lib/api/client';
import type { Family } from '@/lib/api/types';

const schema = z.object({
  inviteCode: z
    .string()
    .min(1, 'Le code est requis')
    .length(6, 'Le code doit contenir 6 caractères')
    .transform((v) => v.trim().toUpperCase()),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinFamilyDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { inviteCode: '' },
  });

  async function onSubmit(data: Values) {
    try {
      const family = await joinFamily(data);
      queryClient.setQueryData<Family>(['family'], family);
      onOpenChange(false);
      form.reset();
      toast.success(`Bienvenue dans la famille ${family.name} !`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_INVITE_CODE') {
        form.setError('inviteCode', { message: 'Code invalide' });
      } else if (err instanceof ApiError && err.code === 'ALREADY_IN_FAMILY') {
        toast.error('Vous êtes déjà dans une famille.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rejoindre une famille</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inviteCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code d&apos;invitation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ABC123"
                      autoCapitalize="characters"
                      autoFocus
                      maxLength={6}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Rejoindre
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
