/* Field review state indicator: icon + text label (never colour alone). © 2026 Shaik Gouse Kareem. */
import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, PencilLine, UserCheck } from 'lucide-react';
import type { ReviewState } from '@billkit/shared';

export type BadgeState = ReviewState | 'user_confirmed';

const MAP: Record<BadgeState, { cls: string; label: string; Icon: typeof CheckCircle2; help: string }> = {
  high_confidence: { cls: 'badge-high', label: 'High confidence', Icon: CheckCircle2, help: 'Found next to a clear label, read confidently and consistent with other checks.' },
  needs_review: { cls: 'badge-review', label: 'Needs review', Icon: HelpCircle, help: 'BillKit is not sure about this value. Please check it against the image.' },
  missing: { cls: 'badge-missing', label: 'Missing', Icon: CircleDashed, help: 'This value could not be found on the bill. Nothing was guessed.' },
  validation_warning: { cls: 'badge-warning', label: 'Validation warning', Icon: AlertTriangle, help: 'This value does not agree with other values (for example, the arithmetic).' },
  user_corrected: { cls: 'badge-user', label: 'You corrected', Icon: PencilLine, help: 'You changed the value BillKit suggested.' },
  user_confirmed: { cls: 'badge-user', label: 'You confirmed', Icon: UserCheck, help: 'You checked this value.' },
};

export function ReviewBadge({ state, compact = false }: { state: BadgeState; compact?: boolean }) {
  const m = MAP[state];
  return (
    <span className={`badge ${m.cls}`} title={m.help}>
      <m.Icon aria-hidden />
      {compact ? <span className="sr-only">{m.label}</span> : m.label}
    </span>
  );
}

export const reviewHelp = (s: BadgeState) => MAP[s].help;
