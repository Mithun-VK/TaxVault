import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') {
    console.info(
      `%c[TaxVault] Connected to backend: ${import.meta.env.VITE_API_BASE_URL}`,
      'color: #1A3C6E; font-weight: bold',
    );
    return;
  }
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
  console.info('%c[TaxVault] MSW active - using mock data', 'color: #0F6E56; font-weight: bold');
}
