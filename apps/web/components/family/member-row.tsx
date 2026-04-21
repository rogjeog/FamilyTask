'use client';

import { useState } from 'react';
import { MoreHorizontal, ShieldCheck, UserMinus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { kickMember, changeMemberRole } from '@/lib/api/families';
import { ApiError } from '@/lib/api/client';
import type { Family, FamilyMember } from '@/lib/api/types';

interface Props {
  member: FamilyMember;
  isCurrentUser: boolean;
  currentUserIsParent: boolean;
}

const roleLabels: Record<string, string> = {
  PARENT: 'Parent',
  CHILD: 'Enfant',
  OTHER: 'Autre',
};

function MemberAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div
      aria-hidden
      className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0"
    >
      <span className="text-xs font-semibold text-accent">{initials}</span>
    </div>
  );
}

export function MemberRow({ member, isCurrentUser, currentUserIsParent }: Props) {
  const queryClient = useQueryClient();
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const canManage =
    currentUserIsParent && !isCurrentUser && member.role !== 'PARENT';

  async function handleKick() {
    setIsPending(true);
    try {
      const family = await kickMember(member.userId);
      queryClient.setQueryData<Family>(['family'], family);
      toast.success(`${member.displayName} a été exclu de la famille.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CANNOT_KICK_PARENT') {
        toast.error('Vous ne pouvez pas exclure un parent.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setIsPending(false);
      setKickDialogOpen(false);
    }
  }

  async function handlePromote() {
    setIsPending(true);
    try {
      const family = await changeMemberRole(member.userId, { role: 'PARENT' });
      queryClient.setQueryData<Family>(['family'], family);
      toast.success(`${member.displayName} est maintenant parent.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FORBIDDEN_NOT_PARENT') {
        toast.error('Vous n\'avez pas les droits nécessaires.');
      } else {
        toast.error('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <li className="flex items-center gap-3">
        <MemberAvatar name={member.displayName} />
        <span className="flex-1 text-sm font-medium text-text-primary">
          {member.displayName}
          {isCurrentUser && (
            <span className="text-text-secondary font-normal ml-1">(vous)</span>
          )}
        </span>
        <Badge variant={member.role === 'PARENT' ? 'primary' : 'secondary'}>
          {roleLabels[member.role] ?? member.role}
        </Badge>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label={`Actions pour ${member.displayName}`}
                disabled={isPending}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{member.displayName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePromote}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Promouvoir en parent
              </DropdownMenuItem>
              <DropdownMenuItem
                destructive
                onClick={() => setKickDialogOpen(true)}
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Exclure de la famille
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </li>

      <AlertDialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Exclure {member.displayName} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {member.displayName} sera retiré de la famille. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleKick} disabled={isPending}>
              Exclure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
