import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { useAuthStore } from '@/store/authStore';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types';

async function fetchAndStoreProfile(setUser: (user: User) => void) {
  try {
    const { data } = await api.get<User>('/users/me');
    setUser(data);
    return data;
  } catch {
    if (import.meta.env.DEV) {
      console.warn('[Auth] Could not fetch user profile after authentication');
    }
    return null;
  }
}

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      api.post<AuthResponse>('/auth/login', data).then((r) => r.data),
    onSuccess: async (tokens) => {
      setAuth(tokens.access_token, tokens.refresh_token);
      const user = await fetchAndStoreProfile((u) => useAuthStore.getState().setUser(u));
      toast.success(`Welcome back${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}`);
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Invalid email or password'),
  });
};

export const useRegister = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
    onSuccess: async (tokens) => {
      setAuth(tokens.access_token, tokens.refresh_token);
      await fetchAndStoreProfile((u) => useAuthStore.getState().setUser(u));
      toast.success('Account created successfully');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error) || 'Could not create account. Try a different email.'),
  });
};

export const useCurrentUser = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/users/me').then((r) => r.data),
    enabled: !!localStorage.getItem('access_token'),
    staleTime: 5 * 60_000,
  });

export const useUpdateProfile = () => {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (data: Partial<Pick<User, 'full_name' | 'phone_number'>>) =>
      api.patch<User>('/users/me', data).then((r) => r.data),
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update profile'),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.patch('/users/me/password', data).then((r) => r.data),
    onSuccess: () => toast.success('Password changed'),
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not change password'),
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (data: { email: string }) =>
      api.post('/auth/forgot-password', data).then((r) => r.data),
    onSuccess: () => toast.success('If that email exists, a reset link is on its way'),
  });
