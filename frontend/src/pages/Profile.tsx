import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Smartphone,
  Monitor,
  Trash2,
  Download,
  Mail,
  MessageSquare,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { useAuthStore } from '@/store/authStore';
import { useUpdateProfile, useChangePassword } from '@/api/auth';
import type { AlertChannel } from '@/types';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  phone_number: z.string().min(10, 'Enter a valid phone number'),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(6, 'Required'),
    new_password: z.string().min(8, 'Use at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#991B1B', '#92400E', '#D97706', '#0F6E56', '#14532D'];
  return { score, label: labels[score], color: colors[score] };
}

const CHANNELS: { value: AlertChannel; label: string; icon: LucideIcon }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'push', label: 'Push', icon: Bell },
];

interface Device {
  id: string;
  name: string;
  icon: LucideIcon;
  lastActive: string;
}

export function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [prefs, setPrefs] = useState<Record<AlertChannel, boolean>>({
    whatsapp: true,
    email: true,
    sms: false,
    push: true,
  });
  const [devices, setDevices] = useState<Device[]>([
    { id: 'dv1', name: 'Pixel 8 · Chrome', icon: Smartphone, lastActive: 'Active now' },
    { id: 'dv2', name: 'MacBook Pro · Safari', icon: Monitor, lastActive: '2 days ago' },
  ]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      phone_number: user?.phone_number ?? '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const newPassword = passwordForm.watch('new_password');
  const strength = useMemo(() => passwordStrength(newPassword || ''), [newPassword]);

  const saveProfile = profileForm.handleSubmit((values) =>
    updateProfile.mutate({ full_name: values.full_name, phone_number: values.phone_number }),
  );

  const savePassword = passwordForm.handleSubmit(async (values) => {
    await changePassword.mutateAsync({
      current_password: values.current_password,
      new_password: values.new_password,
    });
    passwordForm.reset();
  });

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ user, exported_at: new Date().toISOString() }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'taxvault-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data export downloaded');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: personal info */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" {...profileForm.register('full_name')} />
                {profileForm.formState.errors.full_name && (
                  <p className="text-xs text-brand-danger">
                    {profileForm.formState.errors.full_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" disabled {...profileForm.register('email')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone</Label>
                <Input id="phone_number" {...profileForm.register('phone_number')} />
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current password</Label>
                <Input id="current_password" type="password" {...passwordForm.register('current_password')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input id="new_password" type="password" {...passwordForm.register('new_password')} />
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-colors"
                          style={{
                            backgroundColor: i < strength.score ? strength.color : '#E2E6ED',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm new password</Label>
                <Input id="confirm_password" type="password" {...passwordForm.register('confirm_password')} />
                {passwordForm.formState.errors.confirm_password && (
                  <p className="text-xs text-brand-danger">
                    {passwordForm.formState.errors.confirm_password.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Right: settings */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Notification preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CHANNELS.map(({ value, label, icon: Icon }) => (
              <div
                key={value}
                className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toast.success(`Test ${label} alert sent`)}
                    className="text-xs font-medium text-brand-navy hover:underline"
                  >
                    Test
                  </button>
                  <Switch
                    checked={prefs[value]}
                    onCheckedChange={(c) => setPrefs((p) => ({ ...p, [value]: c }))}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Push devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">No registered devices.</p>
            ) : (
              devices.map((device) => {
                const Icon = device.icon;
                return (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-slate-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{device.name}</p>
                        <p className="text-xs text-slate-600">{device.lastActive}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDevices((d) => d.filter((x) => x.id !== device.id));
                        toast.success('Device removed');
                      }}
                      aria-label="Remove device"
                      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-brand-danger">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Export your data</p>
                <p className="text-xs text-slate-600">Download a copy of your account data.</p>
              </div>
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-danger">Delete account</p>
                <p className="text-xs text-slate-600">Permanently remove your account and data.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="This action is irreversible. All your assets, documents and records will be erased."
        confirmLabel="Delete account"
        destructive
        confirmText="DELETE"
        onConfirm={() => {
          toast.success('Account deleted');
          logout();
          navigate('/login');
        }}
      />
    </div>
  );
}
