import { Shield, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUsers, useSetUserRole } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { getInitials } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';

export function Users() {
  const { data: users = [], isLoading } = useUsers();
  const setRole = useSetUserRole();
  const me = useAuthStore((s) => s.user);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Team &amp; access</h2>
        <p className="text-sm text-slate-700">
          Admins have full access — add, edit and manage every record and view analytics. Members
          can view everything and log payments, but can&apos;t change amounts or open analytics.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : users.length === 0 ? (
        <EmptyState icon={UserIcon} title="No users found" description="Invite people by having them register." />
      ) : (
        <Card className="divide-y divide-surface-border">
          {users.map((u) => {
            const isAdmin = u.role === 'admin';
            const isMe = u.id === me?.id;
            const name = u.full_name || u.email;
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
                <Badge
                  variant="outline"
                  className={isAdmin ? 'gap-1.5 text-brand-navy' : 'gap-1.5 text-slate-700'}
                >
                  {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                  {isAdmin ? 'Admin' : 'Member'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={setRole.isPending}
                  onClick={() =>
                    setRole.mutate({ id: u.id, role: isAdmin ? 'user' : 'admin' })
                  }
                >
                  {isAdmin ? (
                    <>
                      <UserIcon className="h-4 w-4" /> Make member
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" /> Make admin
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
