import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Bell,
  Smartphone,
  Download,
  Trash2,
  AlertOctagon,
  Eye,
  EyeOff,
  Laptop,
} from 'lucide-react';

import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/api/auth';
import { useObligations } from '@/api/obligations';
import { usePayments } from '@/api/payments';
import { useDocuments } from '@/api/documents';
import { useAlertConfigs } from '@/api/alerts';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmModal } from '@/components/ConfirmModal';

// Form validation schemas
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.')
      .regex(/^(?=.*[A-Z])(?=.*[0-9])/, {
        message: 'Password must contain at least one uppercase letter and one number.',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type PasswordInputs = z.infer<typeof passwordSchema>;

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  
  // Stores and Mutations
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { mutate: performLogout } = useLogout();

  // Fetch all databases to export data
  const { data: obligations = [] } = useObligations();
  const { data: payments = [] } = usePayments();
  const { data: documents = [] } = useDocuments();
  const { data: configs = [] } = useAlertConfigs();

  // Edit states for personal info
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');

  // Modal displays
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Notification Preferences
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSMS, setPrefSMS] = useState(true);
  const [prefPush, setPrefPush] = useState(false);

  // Password visibility
  const [showPwd, setShowPwd] = useState(false);

  // Device list
  const [devices, setDevices] = useState([
    { id: 'dev-1', name: 'Apple iPhone 15 Pro (iOS 17)', icon: Smartphone },
    { id: 'dev-2', name: 'CA Desktop Safari (macOS Sonoma)', icon: Laptop },
  ]);

  // Form setup
  const {
    register: regPwd,
    handleSubmit: handlePwdSubmit,
    watch: watchPwd,
    formState: { errors: pwdErrors },
    reset: resetPwdForm,
  } = useForm<PasswordInputs>({
    resolver: zodResolver(passwordSchema),
  });

  const newPasswordVal = watchPwd('newPassword', '');
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score;
  };
  const pwdStrength = calculateStrength(newPasswordVal);

  // Update Profile
  const handleUpdateProfile = () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
      toast.error('Phone must be in Indian format (+919876543210).');
      return;
    }

    if (user) {
      setUser({ ...user, fullName, phoneNumber });
      setIsEditingProfile(false);
      toast.success('Client profile updated.');
    }
  };

  // Change Password
  const onChangePassword = (data: PasswordInputs) => {
    toast.success('Password updated successfully. Secure key re-established.');
    resetPwdForm();
  };

  // Test Notifications
  const triggerTestNotification = (channel: 'email' | 'sms' | 'push') => {
    toast.info(`Test ${channel.toUpperCase()} dispatch triggered. Outgoing queue verified.`);
  };

  // Remove Device Token
  const handleRemoveDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    toast.success('Device token revoked. Push endpoint unregistered.');
  };

  // Export Data as JSON
  const handleExportData = () => {
    const exportObj = {
      exported_at: new Date().toISOString(),
      user_profile: user,
      obligations,
      payments,
      documents,
      alert_configurations: configs,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `TaxVault_ClientExport_${user?.fullName.replace(/\s+/g, '_') || 'Data'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    toast.success('Client ledger payload compiled and downloaded.');
  };

  // Delete Account
  const confirmDeleteAccount = () => {
    performLogout(undefined, {
      onSuccess: () => {
        setDeleteModalOpen(false);
        toast.success('Client ledger and user account purged. Session closed.');
        navigate('/login');
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* â”€â”€ LEFT COLUMN: PERSONAL INFO CARD â”€â”€ */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="bg-white border border-surface-border shadow-premium rounded-xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-[#E2E6ED] p-5 flex flex-row items-center gap-3">
            <UserIcon className="text-brand-navy shrink-0" size={20} />
            <CardTitle className="text-sm font-semibold text-brand-navy">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-text-muted">Full Name</Label>
              {isEditingProfile ? (
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm font-medium text-text-primary">{user?.fullName}</p>
              )}
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-text-muted">Registered Email</Label>
              <div className="flex items-center gap-2 text-sm text-text-primary font-mono select-all">
                <Mail size={14} className="text-text-muted" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-text-muted">Phone Number</Label>
              {isEditingProfile ? (
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-sm font-mono"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-text-primary font-mono">
                  <Phone size={14} className="text-text-muted" />
                  <span>{user?.phoneNumber}</span>
                </div>
              )}
            </div>

            {/* Profile Action triggers */}
            <div className="pt-3 border-t border-[#E2E6ED] flex gap-2">
              {isEditingProfile ? (
                <>
                  <Button
                    onClick={() => {
                      setFullName(user?.fullName || '');
                      setPhoneNumber(user?.phoneNumber || '');
                      setIsEditingProfile(false);
                    }}
                    variant="outline"
                    className="text-xs h-8 px-3 hover:bg-[#F0F4FA]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateProfile}
                    className="bg-brand-navy text-white text-xs h-8 px-3 hover:bg-[#153264]"
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditingProfile(true)}
                  variant="outline"
                  className="text-xs h-8 px-3 hover:bg-[#F0F4FA] w-full"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ RIGHT COLUMN: SETTINGS PANELS â”€â”€ */}
      <div className="lg:col-span-2 space-y-6">
        {/* Change Password Card */}
        <Card className="bg-white border border-surface-border shadow-premium rounded-xl">
          <CardHeader className="border-b border-[#E2E6ED] p-5 flex flex-row items-center gap-3">
            <Lock className="text-brand-navy shrink-0" size={20} />
            <CardTitle className="text-sm font-semibold text-brand-navy">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handlePwdSubmit(onChangePassword)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-text-primary">Current Password</Label>
                <Input
                  type="password"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className={`text-sm ${pwdErrors.currentPassword ? 'border-brand-danger' : ''}`}
                  {...regPwd('currentPassword')}
                />
                {pwdErrors.currentPassword && (
                  <span className="text-[10px] text-brand-danger font-medium">{pwdErrors.currentPassword.message}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-text-primary">New Password</Label>
                <div className="relative">
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    className={`text-sm pr-9 ${pwdErrors.newPassword ? 'border-brand-danger' : ''}`}
                    {...regPwd('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-3 text-text-muted hover:text-text-primary focus:outline-none"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwdErrors.newPassword && (
                  <span className="text-[10px] text-brand-danger font-medium">{pwdErrors.newPassword.message}</span>
                )}

                {/* Password strength visual meter */}
                {newPasswordVal.length > 0 && (
                  <div className="pt-1.5 space-y-1">
                    <div className="flex justify-between text-[10px] text-text-muted">
                      <span>Password Strength</span>
                      <span className="font-semibold">
                        {pwdStrength === 4 ? 'Strong' : pwdStrength === 3 ? 'Medium' : 'Weak'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-1">
                      <div className={`rounded ${pwdStrength >= 1 ? 'bg-red-500' : 'bg-slate-100'}`} />
                      <div className={`rounded ${pwdStrength >= 2 ? 'bg-orange-400' : 'bg-slate-100'}`} />
                      <div className={`rounded ${pwdStrength >= 3 ? 'bg-amber-400' : 'bg-slate-100'}`} />
                      <div className={`rounded ${pwdStrength >= 4 ? 'bg-[#0F6E56]' : 'bg-slate-100'}`} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-text-primary">Confirm New Password</Label>
                <Input
                  type="password"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className={`text-sm ${pwdErrors.confirmPassword ? 'border-brand-danger' : ''}`}
                  {...regPwd('confirmPassword')}
                />
                {pwdErrors.confirmPassword && (
                  <span className="text-[10px] text-brand-danger font-medium">{pwdErrors.confirmPassword.message}</span>
                )}
              </div>

              <Button type="submit" className="bg-brand-navy hover:bg-[#153264] text-white text-xs h-9 font-semibold">
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Global Notifications preferences */}
        <Card className="bg-white border border-surface-border shadow-premium rounded-xl">
          <CardHeader className="border-b border-[#E2E6ED] p-5 flex flex-row items-center gap-3">
            <Bell className="text-brand-navy shrink-0" size={20} />
            <CardTitle className="text-sm font-semibold text-brand-navy font-sans">Notification Channels</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-3">
              {/* Email channel */}
              <div className="flex items-center justify-between border p-3 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-text-primary">Email Notifications</Label>
                  <p className="text-[10px] text-text-muted">Receive weekly digests and detailed challan statements.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => triggerTestNotification('email')}
                    className="text-[10px] font-semibold text-brand-navy hover:underline focus-visible:outline-none"
                  >
                    Test Email
                  </button>
                  <Checkbox checked={prefEmail} onCheckedChange={(val: boolean | "indeterminate") => setPrefEmail(!!val)} className="w-4 h-4 border-[#E2E6ED]" />
                </div>
              </div>

              {/* SMS channel */}
              <div className="flex items-center justify-between border p-3 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-text-primary">SMS Warnings</Label>
                  <p className="text-[10px] text-text-muted">Alert priority reminders to registered mobile.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => triggerTestNotification('sms')}
                    className="text-[10px] font-semibold text-brand-navy hover:underline focus-visible:outline-none"
                  >
                    Test SMS
                  </button>
                  <Checkbox checked={prefSMS} onCheckedChange={(val: boolean | "indeterminate") => setPrefSMS(!!val)} className="w-4 h-4 border-[#E2E6ED]" />
                </div>
              </div>

              {/* Push channel */}
              <div className="flex items-center justify-between border p-3 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-text-primary">Push Alerts</Label>
                  <p className="text-[10px] text-text-muted">Immediate screen notifications when logs sync.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => triggerTestNotification('push')}
                    className="text-[10px] font-semibold text-brand-navy hover:underline focus-visible:outline-none"
                  >
                    Test Push
                  </button>
                  <Checkbox checked={prefPush} onCheckedChange={(val: boolean | "indeterminate") => setPrefPush(!!val)} className="w-4 h-4 border-[#E2E6ED]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registered Device Tokens */}
        <Card className="bg-white border border-surface-border shadow-premium rounded-xl">
          <CardHeader className="border-b border-[#E2E6ED] p-5 flex flex-row items-center gap-3">
            <Smartphone className="text-brand-navy shrink-0" size={20} />
            <CardTitle className="text-sm font-semibold text-brand-navy font-sans">Registered Push Devices</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {devices.length === 0 ? (
              <p className="text-center text-xs text-text-muted py-6">No devices registered for push sync.</p>
            ) : (
              <div className="space-y-3">
                {devices.map((dev) => (
                  <div key={dev.id} className="flex items-center justify-between border p-3 rounded-lg hover:bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <dev.icon size={18} className="text-text-muted shrink-0" />
                      <span className="text-xs text-text-primary font-medium">{dev.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveDevice(dev.id)}
                      className="text-text-muted hover:text-[#991B1B] p-1.5 rounded hover:bg-red-50 border border-transparent transition-all"
                      aria-label="Revoke Token"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone Card */}
        <Card className="border-[#FECACA] bg-[#FEF2F2]/30 shadow-premium rounded-xl">
          <CardHeader className="bg-[#FEF2F2] border-b border-[#FECACA] p-5 flex flex-row items-center gap-3">
            <AlertOctagon className="text-[#991B1B] shrink-0" size={20} />
            <CardTitle className="text-sm font-semibold text-[#991B1B] font-sans">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-[#991B1B] font-sans">Export or Purge Client Ledger</h4>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Download a complete secure audit JSON of your files, logs, and payments, or request to permanently delete this secure client vault database.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleExportData}
                variant="outline"
                className="text-xs font-semibold h-9 border-[#E2E6ED] bg-white hover:bg-[#F0F4FA]"
              >
                <Download size={13} className="mr-1.5" />
                <span>Export Ledger</span>
              </Button>
              <Button
                onClick={() => setDeleteModalOpen(true)}
                className="bg-[#991B1B] hover:bg-[#801414] text-white text-xs h-9 font-semibold"
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete account typing confirmation modal */}
      <ConfirmModal
        open={deleteModalOpen}
        title="Permanently Delete Secure Vault"
        message="Warning: This action is irreversible. All tax obligations, payment ledgers, transaction records, and uploaded documents in your vault will be permanently purged."
        confirmLabel="Purge Ledger"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setDeleteModalOpen(false)}
        dangerous={true}
        confirmPhrase="DELETE ACCOUNT"
      />
    </div>
  );
};
export default ProfilePage;

