/* Theme handling: system / light / dark. © 2026 Shaik Gouse Kareem. All rights reserved. */
export type Theme = 'system' | 'light' | 'dark';

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try {
    localStorage.setItem('billkit-theme', theme);
  } catch {
    /* storage unavailable */
  }
}

export function initialTheme(): Theme {
  try {
    return (localStorage.getItem('billkit-theme') as Theme) || 'system';
  } catch {
    return 'system';
  }
}
