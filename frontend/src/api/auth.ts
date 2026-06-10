import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';
import { useAuthStore } from '@/store/authStore';

export function useLogin() {
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);

  return useMutation({
    mutationFn: async (credentials: any) => {
      const response = await apiClient.post('/auth/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      setToken(data.access_token);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    },
  });
}

export function useRegister() {
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);

  return useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      setToken(data.access_token);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    },
  });
}

export function useLogout() {
  const logoutStore = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    },
    onSettled: () => {
      logoutStore();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await apiClient.post('/auth/forgot-password', data);
      return response.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/auth/reset-password', data);
      return response.data;
    },
  });
}
export default useLogin;
