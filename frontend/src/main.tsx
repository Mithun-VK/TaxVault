import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

async function enableMocking() {
  // Use MSW whenever no real backend is configured (local dev + demo deployments)
  if (import.meta.env.VITE_API_URL) {
    return;
  }
  const { worker } = await import('./mocks/browser');
  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

enableMocking().then(() => {
  // Register service worker on load
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration.scope);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '8px',
                fontFamily: 'Inter, sans-serif',
              },
              classNames: {
                success: 'border-l-4 border-l-brand-success bg-white text-text-primary',
                error: 'border-l-4 border-l-brand-danger bg-white text-text-primary',
                info: 'border-l-4 border-l-brand-navy bg-white text-text-primary',
              },
            }}
            richColors
          />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
});
