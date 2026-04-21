'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { register } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const registerSchema = z
  .object({
    email: z.string().email('Adresse e-mail invalide'),
    displayName: z
      .string()
      .min(1, 'Le prénom est requis')
      .max(60, 'Maximum 60 caractères'),
    password: z
      .string()
      .min(8, 'Minimum 8 caractères')
      .max(72, 'Maximum 72 caractères'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['passwordConfirm'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', displayName: '', password: '', passwordConfirm: '' },
  });

  async function onSubmit(data: RegisterValues) {
    try {
      const { user } = await register({
        email: data.email,
        displayName: data.displayName,
        password: data.password,
      });
      queryClient.setQueryData(['me'], { user });
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        form.setError('email', { message: 'Cet email est déjà utilisé' });
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-primary">
            FamilyTask
          </CardTitle>
          <CardDescription>Créez votre espace famille</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse e-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="vous@exemple.fr"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom ou surnom</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Thomas"
                        autoComplete="given-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passwordConfirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                Créer mon compte
              </Button>
              <p className="text-sm text-text-secondary text-center">
                Déjà un compte ?{' '}
                <Link
                  href="/login"
                  className="text-primary hover:text-primary-dark underline-offset-4 hover:underline font-medium"
                >
                  Se connecter
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </main>
  );
}
