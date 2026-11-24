import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Fetch-on-mount hook with reload(). `path` may be null to skip. */
export function useApi(path, { auth = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) { setState({ data: null, error: null, loading: false }); return; }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try { const data = await api(path, { auth }); if (id === seq.current) setState({ data, error: null, loading: false }); }
    catch (error) { if (id === seq.current) setState({ data: null, error, loading: false }); }
  }, [path, auth]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}
