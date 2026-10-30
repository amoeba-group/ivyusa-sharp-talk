import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export interface LineSeries {
  key: string;
  label: string;
  /** Categorical slot, in fixed order: never cycle or re-pick per render. */
  slot: 1 | 2;
  values: number[];
}

interface LineChartProps {
  /** X positions (ISO dates), same length as every series' values. */
  x: string[];
  series: LineSeries[];
  /** Short label for an x value on the axis ("10/28"). */
  formatX?: (v: string) => string;
  /** Full label for the tooltip header ("Tue, Oct 28"). */
  formatXLong?: (v: string) => string;
  formatY?: (v: number) => string;
  height?: number;
  ariaLabel: string;
  /** Column header for the x values in the table view. */
  xLabel: string;
  /** Show the data as a table instead of the plot (dataviz a11y: a table view exists). */
  showTable?: boolean;
  className?: string;
}

const color = (slot: 1 | 2) => `rgb(var(--viz-${slot}))`;

/** 0 → a round ceiling and 4 even steps, so gridlines land on readable numbers. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const stepInt = Math.max(1, Math.ceil(step));
  return { top: stepInt * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * stepInt) };
}

/**
 * Line chart (dataviz): 2px lines, recessive grid, crosshair that snaps to the
 * nearest x, one tooltip listing every series, legend + direct end labels for
 * ≥2 series, keyboard stepping with ←/→, and a table view. Colours come from
 * --viz-N so light and dark each use their validated step.
 */
export function LineChart({
  x,
  series,
  formatX = (v) => v.slice(5).replace('-', '/'),
  formatXLong = (v) => v,
  formatY = (v) => v.toLocaleString(),
  height = 220,
  ariaLabel,
  xLabel,
  showTable = false,
  className,
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const multi = series.length > 1;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const { top, ticks } = niceScale(max);
  const pad = { top: 12, right: multi ? 92 : 16, bottom: 26, left: 40 };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const n = x.length;
  const xAt = (i: number) => (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotH - (v / top) * plotH;

  const paths = useMemo(
    () =>
      series.map((s) =>
        s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(''),
      ),
    // xAt / yAt are pure functions of these.
    [series, plotW, plotH, top, n],
  );

  // Axis labels: one per ~90px, always the last one, and never two labels so
  // close that they collide (the last replaces a too-near predecessor).
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 90))));
  const labelIdx = new Set<number>();
  for (let i = 0; i < n; i += every) labelIdx.add(i);
  if (n > 0) {
    const lastRegular = Math.floor((n - 1) / every) * every;
    if (lastRegular !== n - 1 && n - 1 - lastRegular < every * 0.6) labelIdx.delete(lastRegular);
    labelIdx.add(n - 1);
  }

  const onMove = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = clientX - rect.left - pad.left;
    const i = n <= 1 ? 0 : Math.round((px / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((h) => {
        const cur = h ?? (e.key === 'ArrowRight' ? -1 : n);
        return Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      });
    } else if (e.key === 'Escape') {
      setHover(null);
    }
  };

  if (showTable) {
    return (
      <div className={cn('max-h-[320px] overflow-auto rounded-lg border border-gray-100', className)}>
        <table className="w-full text-sm">
          <caption className="sr-only">{ariaLabel}</caption>
          <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-2">{xLabel}</th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="px-3 py-2 text-right">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {x.map((xv, i) => (
              <tr key={xv}>
                <td className="px-3 py-1.5 text-gray-600">{formatXLong(xv)}</td>
                {series.map((s) => (
                  <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                    {formatY(s.values[i] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const tipLeft = hover == null ? 0 : pad.left + xAt(hover);
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <div className={cn('relative', className)}>
      {multi && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600" aria-hidden>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full" style={{ background: color(s.slot) }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={wrapRef}
        tabIndex={0}
        role="img"
        aria-labelledby={titleId}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span id={titleId} className="sr-only">
          {ariaLabel}
        </span>
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((tv) => (
              <g key={tv}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={yAt(tv)}
                  y2={yAt(tv)}
                  stroke="rgb(var(--st-grid))"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={-10} y={yAt(tv) + 4} textAnchor="end" className="fill-gray-400 text-[11px] tabular-nums">
                  {formatY(tv)}
                </text>
              </g>
            ))}
            {x.map((xv, i) =>
              labelIdx.has(i) ? (
                <text
                  key={xv}
                  x={xAt(i)}
                  y={plotH + 18}
                  textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
                  className="fill-gray-400 text-[11px] tabular-nums"
                >
                  {formatX(xv)}
                </text>
              ) : null,
            )}
            {!multi && series[0] && n > 1 && (
              <path
                d={`${paths[0]}L${xAt(n - 1).toFixed(1)},${plotH}L${xAt(0).toFixed(1)},${plotH}Z`}
                fill={color(series[0].slot)}
                fillOpacity={0.08}
              />
            )}
            {hover != null && (
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={0}
                y2={plotH}
                stroke="rgb(var(--st-axis))"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
            {series.map((s, si) => (
              <path
                key={s.key}
                d={paths[si]}
                fill="none"
                stroke={color(s.slot)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {n === 1 &&
              series.map((s) => (
                <circle key={s.key} cx={xAt(0)} cy={yAt(s.values[0] ?? 0)} r={4} fill={color(s.slot)} />
              ))}
            {/* Direct end labels (≤4 series): identity is never colour alone. */}
            {multi &&
              n > 0 &&
              series.map((s) => (
                <text
                  key={`end-${s.key}`}
                  x={xAt(n - 1) + 8}
                  y={yAt(s.values[n - 1] ?? 0) + 4}
                  className="fill-gray-600 text-[11px] font-medium"
                >
                  {s.label}
                </text>
              ))}
            {hover != null &&
              series.map((s) => (
                <circle
                  key={`dot-${s.key}`}
                  cx={xAt(hover)}
                  cy={yAt(s.values[hover] ?? 0)}
                  r={4.5}
                  fill={color(s.slot)}
                  stroke="rgb(var(--st-surface))"
                  strokeWidth={2}
                />
              ))}
          </g>
        </svg>

        {hover != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-lg border border-gray-200 bg-surface-elevated px-3 py-2 text-xs shadow-pop"
            style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
          >
            <p className="mb-1.5 font-medium text-gray-500">{formatXLong(x[hover])}</p>
            <ul className="space-y-1">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color(s.slot) }} />
                  <span className="text-sm font-semibold tabular-nums text-gray-900">
                    {formatY(s.values[hover] ?? 0)}
                  </span>
                  <span className="truncate text-gray-500">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
