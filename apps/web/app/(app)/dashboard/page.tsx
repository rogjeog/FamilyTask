'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/use-session';
import { useFamily } from '@/lib/hooks/use-family';
import { logout } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { FamilyCard } from '@/components/family/family-card';
import { CreateFamilyDialog } from '@/components/family/create-family-dialog';
import { JoinFamilyDialog } from '@/components/family/join-family-dialog';

export default function DashboardPage() {
  // Both queries launch in parallel — no enabled: !!user dependency between them
  const { user } = useSession();
  const { family, isLoading: familyLoading } = useFamily();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error('Erreur lors de la déconnexion. Veuillez réessayer.');
        return;
      }
      // ApiError (e.g. 401 after expired session): client.ts already cleaned up
    }
    queryClient.removeQueries({ queryKey: ['me'] });
    queryClient.removeQueries({ queryKey: ['family'] });
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

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-primary">
          Bienvenue, {user?.displayName}&nbsp;!
        </h1>

        {familyLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : family ? (
          <FamilyCard family={family} currentUserId={user?.id ?? ''} />
        ) : (
          <div className="space-y-4">
            <p className="text-text-secondary">
              Vous n&apos;êtes pas encore dans une famille. Créez-en une ou
              rejoignez une famille existante.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setCreateOpen(true)}>
                Créer une famille
              </Button>
              <Button variant="outline" onClick={() => setJoinOpen(true)}>
                Rejoindre une famille
              </Button>
            </div>
          </div>
        )}
      </main>

      <CreateFamilyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinFamilyDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
