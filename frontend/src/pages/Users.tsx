import { ShieldCheck, ShieldHalf, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUsers, useSetUserRole } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { getInitials } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/utils/permissions';
import type { UserRole } from '@/types';

const ROLE_ORDER: UserRole[] = ['super_admin', 'admin', 'user'];

const ROLE_BADGE: Record<UserRole, { icon: typeof UserIcon; className: string }> = {
  super_admin: { icon: ShieldCheck, className: 'gap-1.5 text-brand-navy' },
  admin: { icon: ShieldHalf, className: 'gap-1.5 text-brand-teal' },
  user: { icon: UserIcon, className: 'gap-1.5 text-slate-700' },
};

export function Users() {
  const { data: users = [], isLoading } = useUsers();
  const setRole = useSetUserRole();
  const me = useAuthStore((s) => s.user);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Team &amp; access</h2>
        <p className="text-sm text-slate-700">
          Every account reads the same vault; the role decides what they can do with it.
        </p>
      </div>

      <Card className="divide-y divide-surface-border">
        {ROLE_ORDER.map((role) => {
          const Icon = ROLE_BADGE[role].icon;
          return (
            <div key={role} className="flex items-start gap-3 p-4">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">{ROLE_LABELS[role]}</span> -{' '}
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          );
        })}
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserIcon}
          title="No users found"
          description="Invite people by having them register."
        />
      ) : (
        <Card className="divide-y divide-surface-border">
          {users.map((u) => {
            const isMe = u.id === me?.id;
            const name = u.full_name || u.email;
            const badge = ROLE_BADGE[u.role];
            const BadgeIcon = badge.icon;
            return (
              <div key={u.id} className="flex items-center gap-4 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                    {isMe && <span className="text-xs text-slate-600">(you)</span>}
                  </div>
                  <p className="truncate text-xs text-slate-700">{u.email}</p>
                </div>
                <div className="hidden text-xs text-slate-600 sm:block">
                  Joined {formatDate(u.created_at)}
                </div>
                <Badge variant="outline" className={badge.className}>
                  <BadgeIcon className="h-3 w-3" />
                  {ROLE_LABELS[u.role]}
                </Badge>
                {/* The backend refuses to demote the last super admin, so the
                    deployment can never lose its only full-access account. */}
                <Select
                  value={u.role}
                  disabled={setRole.isPending}
                  onValueChange={(role) => setRole.mutate({ id: u.id, role: role as UserRole })}
                >
                  <SelectTrigger className="w-40" aria-label={`Change role for ${name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_ORDER.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
