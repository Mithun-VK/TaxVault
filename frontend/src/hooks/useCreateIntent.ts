import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Opens a page's "create" flow when it is reached with `?new=1` in the URL,
 * then strips the flag so a refresh/back doesn't re-trigger it. This lets the
 * command palette and the global "+ New" menu deep-link straight into adding an
 * entity on any page (e.g. /taxes?type=water_tax&new=1).
 */
export function useCreateIntent(onTrigger: () => void) {
  const [params, setParams] = useSearchParams();
  const cb = useRef(onTrigger);
  cb.current = onTrigger;

  useEffect(() => {
    if (params.get('new') !== '1') return;
    cb.current();
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
