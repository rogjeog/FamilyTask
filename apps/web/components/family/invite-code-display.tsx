'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { regenerateInvite } from '@/lib/api/families';
import { ApiError } from '@/lib/api/client';
import type { Family } from '@/lib/api/types';

interface Props {
  inviteCode: string;
  familyId: string;
  isParent: boolean;
}

export function InviteCodeDisplay({ inviteCode, familyId, isParent }: Props) {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const queryClient = useQueryClient();

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const family = await regenerateInvite(familyId);
      queryClient.setQueryData<Family>(['family'], family);
      toast.success('Code d\'invitation régénéré.');
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error('Erreur lors de la régénération du code.');
      }
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Partagez ce code pour inviter des membres
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {/* CSS uppercase as defence-in-depth even though codes are already uppercase */}
        <span className="font-mono text-3xl font-bold tracking-widest text-primary uppercase select-all">
          {inviteCode}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copier le code">
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ml-1.5">{copied ? 'Copié !' : 'Copier'}</span>
        </Button>
      </div>

      {isParent && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-text-secondary hover:text-text-primary -ml-2"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Régénérer le code
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Régénérer le code d&apos;invitation ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                L&apos;ancien code cessera immédiatement de fonctionner. Les
                membres déjà dans la famille ne sont pas affectés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                Régénérer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
