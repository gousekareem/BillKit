/* Lightweight, accessible SVG charts (no chart library; real data only). © 2026 Shaik Gouse Kareem. */
import { monthLabel, money } from '../utils/format';

export function MonthlyBars({ data, currency }: { data: Array<{ month: string; total: number; count: number }>; currency: string }) {
  const W = 640;
  const H = 220;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.total));
  const bw = (W - pad.l - pad.r) / data.length;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly spending in ${currency} for the last ${data.length} months`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--color-border-strong)" />
        {data.map((d, i) => {
          const h = ((H - pad.t - pad.b) * d.total) / max;
          const x = pad.l + i * bw + bw * 0.18;
          return (
            <g key={d.month}>
              <rect className="bar" x={x} y={H - pad.b - h} width={bw * 0.64} height={Math.max(h, d.total > 0 ? 2 : 0)} rx={4}>
                <title>{`${monthLabel(d.month)} ${d.month.slice(0, 4)}: ${money(d.total, currency)} across ${d.count} bill(s)`}</title>
              </rect>
              <text x={x + bw * 0.32} y={H - 10} textAnchor="middle">{monthLabel(d.month)}</text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Monthly spending</caption>
        <thead><tr><th>Month</th><th>Total</th><th>Bills</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.month}><td>{d.month}</td><td>{money(d.total, currency)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function BarList({ rows, currency, onSelect }: { rows: Array<{ label: string; value: number; count?: number }>; currency: string; onSelect?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bar-list">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          {onSelect ? (
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', padding: 0, minHeight: 28 }} onClick={() => onSelect(r.label)}>{r.label}</button>
          ) : (
            <span>{r.label}</span>
          )}
          <div className="bar-track" aria-hidden><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className="nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(r.value, currency)}
            {r.count !== undefined && <span className="subtle"> · {r.count}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
