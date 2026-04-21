import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InviteCodeDisplay } from './invite-code-display';
import type { Family } from '@/lib/api/types';

interface Props {
  family: Family;
  currentUserId: string;
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

export function FamilyCard({ family, currentUserId }: Props) {
  const currentMember = family.members.find((m) => m.userId === currentUserId);
  const isParent = currentMember?.role === 'PARENT';

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-text-primary">{family.name}</CardTitle>
        <InviteCodeDisplay
          inviteCode={family.inviteCode}
          familyId={family.id}
          isParent={isParent ?? false}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Membres ({family.members.length})
        </p>
        <ul className="space-y-2">
          {family.members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3">
              <MemberAvatar name={member.displayName} />
              <span className="flex-1 text-sm font-medium text-text-primary">
                {member.displayName}
                {member.userId === currentUserId && (
                  <span className="text-text-secondary font-normal ml-1">
                    (vous)
                  </span>
                )}
              </span>
              <Badge variant={member.role === 'PARENT' ? 'primary' : 'secondary'}>
                {roleLabels[member.role] ?? member.role}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
