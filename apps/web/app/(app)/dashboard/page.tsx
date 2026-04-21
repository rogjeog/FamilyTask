'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/use-session';
import { logout } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function DashboardPage() {
  const { user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error('Erreur lors de la déconnexion. Veuillez réessayer.');
        return;
      }
      // ApiError (e.g. 401): session already cleaned up by client.ts, continue
    }
    queryClient.removeQueries({ queryKey: ['me'] });
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-background border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-primary">FamilyTask</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Se déconnecter
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            Bienvenue, {user?.displayName}&nbsp;!
          </h1>
          <p className="mt-2 text-text-secondary">
            Vous n&apos;êtes pas encore dans une famille. Créez-en une ou
            rejoignez une famille existante.
          </p>
        </div>

        <div className="flex gap-3">
          <Button disabled>Créer une famille</Button>
          <Button variant="outline" disabled>
            Rejoindre une famille
          </Button>
        </div>
      </main>
    </div>
  );
}
