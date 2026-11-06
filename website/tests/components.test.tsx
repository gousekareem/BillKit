import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewBadge } from '../src/components/ReviewBadge';
import { PasswordField, TextField, fieldErrors } from '../src/components/Form';
import { Dialog } from '../src/components/Dialog';
import { BarList, MonthlyBars } from '../src/components/Charts';
import { money, date, monthLabel, pct } from '../src/utils/format';
import { validateFile } from '../src/utils/image';

describe('ReviewBadge', () => {
  it.each([
    ['high_confidence', 'High confidence'],
    ['needs_review', 'Needs review'],
    ['missing', 'Missing'],
    ['validation_warning', 'Validation warning'],
    ['user_corrected', 'You corrected'],
  ] as const)('%s shows a text label, not colour only', (state, label) => {
    render(<ReviewBadge state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
  it('keeps an accessible label in compact mode', () => {
    render(<ReviewBadge state="needs_review" compact />);
    expect(screen.getByText('Needs review')).toHaveClass('sr-only');
  });
});

describe('form primitives', () => {
  it('associates labels, hints and errors', () => {
    render(<TextField label="Email" hint="We never share it" error="Enter a valid email address" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('-e');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
  });
  it('toggles password visibility', async () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
  it('maps API field errors', () => {
    expect(fieldErrors([{ path: 'fields.totalAmount', message: 'Required' }])).toEqual({ totalAmount: 'Required' });
  });
});

describe('Dialog', () => {
  it('is a labelled modal that closes on Escape', async () => {
    let closed = false;
    render(<Dialog open title="Delete this bill?" onClose={() => (closed = true)}><p>Body</p></Dialog>);
    expect(screen.getByRole('dialog', { name: 'Delete this bill?' })).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(true);
  });
});

describe('charts', () => {
  it('render real data with an accessible table equivalent', () => {
    render(<MonthlyBars currency="INR" data={[{ month: '2026-10', total: 1200, count: 2 }, { month: '2026-11', total: 0, count: 0 }]} />);
    expect(screen.getByRole('img', { name: /Monthly spending in INR/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Monthly spending' })).toBeInTheDocument();
    render(<BarList currency="INR" rows={[{ label: 'Food', value: 500, count: 3 }]} />);
    expect(screen.getByText('Food')).toBeInTheDocument();
  });
});

describe('formatting & validation helpers', () => {
  it('formats money, dates and percentages', () => {
    expect(money(125000.5, 'INR')).toMatch(/1,25,000\.50/);
    expect(money(null)).toBe('—');
    expect(date('2026-10-14', 'DMY')).toBe('14/10/2026');
    expect(date('2026-10-14', 'MDY')).toBe('10/14/2026');
    expect(monthLabel('2026-10')).toBe('Oct');
    expect(pct(0.856)).toBe('86%');
  });
  it('validates file type and size on the client', () => {
    expect(validateFile(new File(['x'], 'a.gif', { type: 'image/gif' }), 15)).toMatch(/unsupported/);
    expect(validateFile(new File([new Uint8Array(2 * 1024 * 1024)], 'a.jpg', { type: 'image/jpeg' }), 1)).toMatch(/larger than 1 MB/);
    expect(validateFile(new File(['x'], 'bill.heic', { type: '' }), 15)).toBeNull();
    expect(validateFile(new File([], 'e.png', { type: 'image/png' }), 15)).toMatch(/empty/);
  });
});
