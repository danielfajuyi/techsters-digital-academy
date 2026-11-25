import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'techsters-theme';
const Ctx = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });
export const useTheme = () => useContext(Ctx);

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const read = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(read);
  const [sysDark, setSysDark] = useState(systemDark);
  const resolved = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', resolved === 'dark'); }, [resolved]);

  const setTheme = useCallback((t) => { try { localStorage.setItem(KEY, t); } catch { /* private mode */ } setThemeState(t); }, []);
  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

/** Sun/moon toggle. The first visit follows the device setting; clicking pins a choice. */
export function ThemeToggle({ className = '' }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={() => setTheme(next)} className={`btn-ghost px-2 ${className}`} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {resolved === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
