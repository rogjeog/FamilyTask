import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InviteCodeDisplay } from './invite-code-display';
import { MemberRow } from './member-row';
import { FamilySettings } from './family-settings';
import type { Family } from '@/lib/api/types';

interface Props {
  family: Family;
  currentUserId: string;
}

export function FamilyCard({ family, currentUserId }: Props) {
  const currentMember = family.members.find((m) => m.userId === currentUserId);
  const isParent = currentMember?.role === 'PARENT';

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl text-text-primary">{family.name}</CardTitle>
          <FamilySettings family={family} isParent={isParent ?? false} />
        </div>
        <InviteCodeDisplay
          inviteCode={family.inviteCode}
          isParent={isParent ?? false}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Membres ({family.members.length})
        </p>
        <ul className="space-y-2">
          {family.members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isCurrentUser={member.userId === currentUserId}
              currentUserIsParent={isParent ?? false}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
