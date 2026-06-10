import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Bell,
  FolderLock,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useLogin, useRegister, useForgotPassword } from '@/api/auth';

// Zod schemas
const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

const registerSchema = z
  .object({
    fullName: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
    email: z.string().email({ message: 'Please enter a valid email address.' }),
    phoneNumber: z
      .string()
      .regex(/^\+91[6-9]\d{9}$/, { message: 'Phone must be in Indian format (+919876543210).' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' })
      .regex(/^(?=.*[A-Z])(?=.*[0-9])/, {
        message: 'Password must contain at least one uppercase letter and one number.',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type LoginInputs = z.infer<typeof loginSchema>;
type RegisterInputs = z.infer<typeof registerSchema>;
type ForgotInputs = z.infer<typeof forgotPasswordSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // API mutations
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const forgotPasswordMutation = useForgotPassword();

  // Forms hook setup
  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    reset: resetLoginForm,
  } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors },
    watch: watchRegister,
    reset: resetRegisterForm,
  } = useForm<RegisterInputs>({
    resolver: zodResolver(registerSchema),
  });

  const {
    register: forgotRegister,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors },
    reset: resetForgotForm,
  } = useForm<ForgotInputs>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Register watch to compute password strength
  const passwordVal = watchRegister('password', '');
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score; // Max 4
  };
  const pwStrength = calculateStrength(passwordVal);

  // Handlers
  const onLogin = (data: LoginInputs) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Login successful. Welcome back!');
        resetLoginForm();
        navigate('/');
      },
      onError: (err: any) => {
        toast.error(err.message || 'Login failed. Please check your credentials.');
      },
    });
  };

  const onRegister = (data: RegisterInputs) => {
    registerMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Registration successful! Secure vault initialized.');
        resetRegisterForm();
        navigate('/');
      },
      onError: (err: any) => {
        toast.error(err.message || 'Registration failed. Please try again.');
      },
    });
  };

  const onForgot = (data: ForgotInputs) => {
    forgotPasswordMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Reset guidelines sent! Please check your mailbox.');
        resetForgotForm();
        setView('login');
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to dispatch reset link.');
      },
    });
  };

  const toggleView = (target: 'login' | 'register' | 'forgot') => {
    setView(target);
    // Clear errors or reset states
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* ── LEFT PANE: BRAND PANEL (deep navy) ── */}
      <div className="hidden md:flex flex-col justify-between bg-brand-navy p-12 text-white relative overflow-hidden select-none">
        {/* Background decorative vectors */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-400 via-blue-900 to-black pointer-events-none" />

        {/* Logo Monogram */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 backdrop-blur text-white border border-white/20 shadow-lg">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight leading-none block">TaxVault</span>
            <span className="text-[10px] text-teal-400 font-semibold tracking-widest uppercase">Institutional Grade</span>
          </div>
        </div>

        {/* Tagline & Focus */}
        <div className="my-auto max-w-sm space-y-4 relative z-10">
          <h2 className="text-3xl font-semibold tracking-tight text-white leading-tight">
            Your taxes. Organized. On time.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-light">
            TaxVault consolidates your private capital accounts, property holdings, and business ledgers under single-client secure encryption.
          </p>
        </div>

        {/* Trust Signals */}
        <div className="space-y-4 border-t border-white/10 pt-8 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-white/10 rounded-lg text-teal-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Bank-grade encryption</p>
              <p className="text-[10.5px] text-slate-300 mt-0.5 font-light">Zero-knowledge storage layers keep personal records private.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-white/10 rounded-lg text-teal-400">
              <Bell size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Deadline alerts</p>
              <p className="text-[10.5px] text-slate-300 mt-0.5 font-light">Custom SMS and Email alerts warn you before deadlines lapse.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-white/10 rounded-lg text-teal-400">
              <FolderLock size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Document vault</p>
              <p className="text-[10.5px] text-slate-300 mt-0.5 font-light">Attach invoices and statements directly to obligations.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANE: FORM PANEL (off-white) ── */}
      <div className="flex items-center justify-center p-6 bg-surface-page md:p-12 overflow-y-auto">
        <Card className="w-full max-w-[420px] bg-white border border-surface-border shadow-premium rounded-xl p-8">
          <CardContent className="p-0 space-y-6">
            {/* Header info */}
            <div>
              {view !== 'login' && (
                <button
                  onClick={() => setView('login')}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-all mb-4 focus-visible:outline-none"
                >
                  <ArrowLeft size={14} />
                  <span>Back to sign in</span>
                </button>
              )}
              <h3 className="text-xl font-semibold text-brand-navy">
                {view === 'login'
                  ? 'Client Sign In'
                  : view === 'register'
                  ? 'Open Account'
                  : 'Recover Account'}
              </h3>
              <p className="text-xs text-text-muted mt-1">
                {view === 'login'
                  ? 'Authenticate to access your private tax panel.'
                  : view === 'register'
                  ? 'Initialize your secure client vault settings.'
                  : 'Provide your registered email to reset password.'}
              </p>
            </div>

            {/* ── LOGIN VIEW ── */}
            {view === 'login' && (
              <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-text-primary">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="client@taxvault.in"
                      className={`pl-9 text-sm border-surface-border ${loginErrors.email ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...loginRegister('email')}
                    />
                  </div>
                  {loginErrors.email && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {loginErrors.email.message}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-text-primary">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-xs font-semibold text-brand-navy hover:underline focus-visible:outline-none"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`pl-9 pr-9 text-sm border-surface-border ${loginErrors.password ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...loginRegister('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-text-muted hover:text-text-primary"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {loginErrors.password && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {loginErrors.password.message}
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-brand-navy hover:bg-[#153264] text-white py-2 rounded-lg font-medium text-sm transition-all h-10 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loginMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <span className="text-xs text-text-muted">
                    New to TaxVault?{' '}
                    <button
                      type="button"
                      onClick={() => toggleView('register')}
                      className="font-bold text-brand-navy hover:underline"
                    >
                      Request access
                    </button>
                  </span>
                </div>
              </form>
            )}

            {/* ── REGISTER VIEW ── */}
            {view === 'register' && (
              <form onSubmit={handleRegisterSubmit(onRegister)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-text-primary">
                    Full Name
                  </Label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="fullName"
                      placeholder="Aditya Birla"
                      className={`pl-9 text-sm border-surface-border ${registerErrors.fullName ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...registerRegister('fullName')}
                    />
                  </div>
                  {registerErrors.fullName && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {registerErrors.fullName.message}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs font-semibold text-text-primary">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="client@taxvault.in"
                      className={`pl-9 text-sm border-surface-border ${registerErrors.email ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...registerRegister('email')}
                    />
                  </div>
                  {registerErrors.email && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {registerErrors.email.message}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber" className="text-xs font-semibold text-text-primary">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="phoneNumber"
                      placeholder="+919876543210"
                      className={`pl-9 text-sm border-surface-border ${registerErrors.phoneNumber ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...registerRegister('phoneNumber')}
                    />
                  </div>
                  {registerErrors.phoneNumber && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {registerErrors.phoneNumber.message}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-xs font-semibold text-text-primary">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`pl-9 pr-9 text-sm border-surface-border ${registerErrors.password ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...registerRegister('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-text-muted"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {registerErrors.password && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {registerErrors.password.message}
                    </span>
                  )}

                  {/* Password strength visual meter */}
                  {passwordVal.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      <div className="flex justify-between text-[10px] text-text-muted">
                        <span>Password Strength</span>
                        <span className="font-semibold">
                          {pwStrength === 4 ? 'Strong' : pwStrength === 3 ? 'Medium' : 'Weak'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 h-1">
                        <div className={`rounded ${pwStrength >= 1 ? 'bg-red-500' : 'bg-slate-100'}`} />
                        <div className={`rounded ${pwStrength >= 2 ? 'bg-orange-400' : 'bg-slate-100'}`} />
                        <div className={`rounded ${pwStrength >= 3 ? 'bg-amber-400' : 'bg-slate-100'}`} />
                        <div className={`rounded ${pwStrength >= 4 ? 'bg-[#0F6E56]' : 'bg-slate-100'}`} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-text-primary">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`pl-9 text-sm border-surface-border ${registerErrors.confirmPassword ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...registerRegister('confirmPassword')}
                    />
                  </div>
                  {registerErrors.confirmPassword && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {registerErrors.confirmPassword.message}
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="w-full bg-brand-navy hover:bg-[#153264] text-white py-2 rounded-lg font-medium text-sm transition-all h-10 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {registerMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span>Register</span>
                  )}
                </Button>
              </form>
            )}

            {/* ── FORGOT PASSWORD VIEW ── */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotSubmit(onForgot)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-xs font-semibold text-text-primary">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-text-muted" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="client@taxvault.in"
                      className={`pl-9 text-sm border-surface-border ${forgotErrors.email ? 'border-brand-danger focus-visible:ring-brand-danger' : ''}`}
                      {...forgotRegister('email')}
                    />
                  </div>
                  {forgotErrors.email && (
                    <span className="text-[10.5px] text-brand-danger font-medium block">
                      {forgotErrors.email.message}
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={forgotPasswordMutation.isPending}
                  className="w-full bg-brand-navy hover:bg-[#153264] text-white py-2 rounded-lg font-medium text-sm transition-all h-10 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {forgotPasswordMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span>Send Reset Code</span>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default LoginPage;
