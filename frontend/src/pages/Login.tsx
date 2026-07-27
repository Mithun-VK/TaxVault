import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, BellRing, FolderLock, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin, useRegister, useForgotPassword } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

type Mode = 'login' | 'register' | 'forgot';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  full_name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  phone_number: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const forgotSchema = z.object({ email: z.string().email('Enter a valid email') });

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-brand-danger">{message}</p> : null;
}

function PasswordInput({
  id,
  autoComplete,
  fieldProps,
}: {
  id: string;
  autoComplete: string;
  fieldProps: ReturnType<ReturnType<typeof useForm>['register']>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className="pr-10"
        {...fieldProps}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex h-full w-10 items-center justify-center text-slate-600 hover:text-text-primary"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch {
      // toast already shown by useLogin's onError
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button type="button" onClick={onForgot} className="text-xs font-medium text-brand-navy hover:underline">
            Forgot password?
          </button>
        </div>
        <PasswordInput id="password" autoComplete="current-password" fieldProps={register('password')} />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function RegisterForm() {
  const navigate = useNavigate();
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values);
      navigate('/');
    } catch {
      // toast already shown by useRegister's onError
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" {...register('full_name')} />
        <FieldError message={errors.full_name?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input id="reg-email" type="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone_number">Phone</Label>
        <Input id="phone_number" type="tel" placeholder="+91 ..." {...register('phone_number')} />
        <FieldError message={errors.phone_number?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <PasswordInput id="reg-password" autoComplete="new-password" fieldProps={register('password')} />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={registerUser.isPending}>
        {registerUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const forgot = useForgotPassword();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync(values);
      setSent(true);
    } catch {
      // toast already shown by useForgotPassword's onError
    }
  });

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-600">
          If an account exists for that email, you'll receive a reset link shortly.
        </p>
        <Button variant="secondary" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" type="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={forgot.isPending}>
        {forgot.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Send reset link
      </Button>
      <button type="button" onClick={onBack} className="w-full text-sm text-slate-700 hover:underline">
        Back to sign in
      </button>
    </form>
  );
}

const TRUST_SIGNALS = [
  { icon: ShieldCheck, title: 'Bank-grade encryption', text: 'Your financial records stay private and secure.' },
  { icon: BellRing, title: 'Deadline alerts', text: 'Never miss a tax, premium or bill due date again.' },
  { icon: FolderLock, title: 'Document vault', text: 'Every receipt and policy, organised in one place.' },
];

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-surface-page">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-brand-navy p-12 text-white lg:flex">
        <Logo variant="light" size={36} />
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Your assets. Your finances. Always on time.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            TaxVault keeps your assets, taxes, insurance and bills in one calm, dependable place.
          </p>
          <ul className="mt-10 space-y-5">
            {TRUST_SIGNALS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} TaxVault. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <Logo size={36} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {mode === 'login' && 'Welcome back'}
                {mode === 'register' && 'Create your account'}
                {mode === 'forgot' && 'Reset your password'}
              </h1>
              <p className="mb-8 mt-1 text-sm text-slate-700">
                {mode === 'login' && 'Sign in to access your vault.'}
                {mode === 'register' && 'Start managing your assets in minutes.'}
                {mode === 'forgot' && "We'll email you a secure reset link."}
              </p>

              {mode === 'login' && <LoginForm onForgot={() => setMode('forgot')} />}
              {mode === 'register' && <RegisterForm />}
              {mode === 'forgot' && <ForgotForm onBack={() => setMode('login')} />}
            </motion.div>
          </AnimatePresence>

          {mode !== 'forgot' && (
            <p className="mt-6 text-center text-sm text-slate-700">
              {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="font-medium text-brand-navy hover:underline"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
