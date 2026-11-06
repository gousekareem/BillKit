/* Empty states with original illustrations. © 2026 Shaik Gouse Kareem. */
import type { ReactNode } from 'react';

export function EmptyArt() {
  return (
    <svg className="empty-art" viewBox="0 0 160 110" aria-hidden>
      <rect x="30" y="18" width="62" height="78" rx="6" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
      <rect x="40" y="30" width="40" height="5" rx="2.5" fill="var(--color-border-strong)" />
      <rect x="40" y="42" width="30" height="5" rx="2.5" fill="var(--color-border-strong)" />
      <rect x="40" y="54" width="40" height="5" rx="2.5" fill="var(--color-border-strong)" />
      <path d="M22 66h78v18a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14V66z" fill="var(--color-primary-soft)" stroke="var(--color-primary)" />
      <path d="M28 72h66" stroke="var(--color-primary)" strokeDasharray="4 3" />
      <circle cx="118" cy="40" r="16" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2" />
      <path d="M118 32v16M110 40h16" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <EmptyArt />
      <h3>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: '32rem', margin: '0 auto var(--space-5)' }}>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: string | number }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="stack" style={{ padding: 'var(--space-4) 0' }}>
      <span className="sr-only">{label}</span>
      <Skeleton height={22} width="40%" />
      <Skeleton height={14} />
      <Skeleton height={14} width="85%" />
      <Skeleton height={14} width="70%" />
    </div>
  );
}
