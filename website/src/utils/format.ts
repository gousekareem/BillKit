/* Display formatting. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { formatIsoDate, formatMoney } from '@billkit/shared';

export const money = (v: number | null | undefined, currency = 'INR') => formatMoney(v, currency, currency === 'INR' ? 'en-IN' : 'en-US');
export const date = (iso: string | null | undefined, fmt: 'DMY' | 'MDY' | 'YMD' = 'DMY') => formatIsoDate(iso, fmt);
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
};
export const relativeTime = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
