"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "motion/react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";
import { chartReveal } from "@/lib/motion";
import type { AppLocale } from "@/i18n/config";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

/**
 * Chart conventions (dataviz method):
 *  - one y-axis only; recessive grid; thin marks with 4px rounded data-ends
 *  - categorical colors in fixed order (--chart-1..4), color follows the series
 *  - every chart has a visually-hidden data table; ≥2 series get a legend
 *  - text uses text tokens, never the series color
 *  - RTL: x-axis is reversed so time still reads in the reading direction
 */
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function useMoney(currency: string) {
  const locale = useLocale() as AppLocale;
  return {
    full: (v: number | string) => formatMoney(String(v), currency, locale),
    compact: (v: number | string) => formatMoney(String(v), currency, locale, { compact: true }),
    rtl: locale === "ur",
  };
}

function ChartTooltip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-elevated px-3 py-2 text-xs shadow-[var(--shadow-raised)]">
      {label && <p className="mb-1 font-semibold text-text">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="tabular ms-auto ps-3 font-semibold text-text" dir="ltr">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm" style={{ background: i.color }} /> {i.label}</li>
      ))}
    </ul>
  );
}

function SrTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    // A <table> ignores sr-only width, so the wrapper carries the visually-hidden styles.
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
    </div>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div variants={chartReveal} initial={reduced ? "visible" : "hidden"} whileInView="visible" viewport={{ once: true }}>
      {children}
    </motion.div>
  );
}

const axis = { tick: { fill: "var(--text-muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

/** Monthly trend: 1–2 series (e.g. employee expenses vs vendor invoices), stacked areas. */
export function TrendChart({ data, series, currency, caption, height = 260 }: { data: Record<string, string | number>[]; series: { key: string; label: string }[]; currency: string; caption: string; height?: number }) {
  const m = useMoney(currency);
  return (
    <div>
      <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i]! }))} />
      <Reveal>
        <div style={{ height }} dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[i]} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={SERIES[i]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" {...axis} tick={{ ...axis.tick, fontSize: m.rtl ? 14 : 11 }} height={m.rtl ? 38 : 30} reversed={m.rtl} interval="preserveStartEnd" />
              <YAxis {...axis} width={64} tickFormatter={(v) => m.compact(v)} orientation={m.rtl ? "right" : "left"} />
              <Tooltip content={<ChartTooltip fmt={(v) => m.full(v)} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
              {series.map((s, i) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="1" stroke={SERIES[i]} strokeWidth={2} fill={`url(#g-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Reveal>
      <SrTable caption={caption} columns={["", ...series.map((s) => s.label)]} rows={data.map((d) => [String(d.label), ...series.map((s) => m.full(d[s.key] ?? 0))])} />
    </div>
  );
}

/** Single-series vertical bars (branch comparison). One hue — identity is the axis label. */
export function ColumnChart({ data, currency, caption, height = 260 }: { data: { label: string; value: number }[]; currency: string; caption: string; height?: number }) {
  const m = useMoney(currency);
  return (
    <div>
      <Reveal>
        <div style={{ height }} dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" {...axis} tick={{ ...axis.tick, fontSize: m.rtl ? 14 : 11 }} height={m.rtl ? 38 : 30} reversed={m.rtl} interval={m.rtl ? "preserveStartEnd" : 0} />
              <YAxis {...axis} width={64} tickFormatter={(v) => m.compact(v)} orientation={m.rtl ? "right" : "left"} />
              <Tooltip content={<ChartTooltip fmt={(v) => m.full(v)} />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="value" name={caption} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Reveal>
      <SrTable caption={caption} columns={["", caption]} rows={data.map((d) => [d.label, m.full(d.value)])} />
    </div>
  );
}

/** Horizontal ranked bars in plain HTML: exact labels, RTL-native, no SVG needed. */
export function BarList({ data, currency, caption, max = 8 }: { data: { label: string; value: string; share: number }[]; currency: string; caption: string; max?: number }) {
  const m = useMoney(currency);
  const reduced = useReducedMotion();
  const top = data.slice(0, max);
  const peak = Math.max(...top.map((d) => d.share), 0.0001);
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <ul className="space-y-3">
        {top.map((d, i) => (
          <li key={d.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{d.label}</span>
              <span className="tabular shrink-0 text-muted" dir="ltr">{m.full(d.value)} · {Math.round(d.share * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--chart-1)", opacity: 1 - i * 0.07 }}
                initial={{ width: reduced ? `${(d.share / peak) * 100}%` : 0 }}
                whileInView={{ width: `${(d.share / peak) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Status donut — status colors (not categorical), always paired with text labels and counts. */
export function StatusDonut({ data, caption, centerLabel, centerValue }: { data: { key: string; label: string; value: number; color: string }[]; caption: string; centerLabel: string; centerValue: string }) {
  const nonZero = data.filter((d) => d.value > 0);
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="relative mx-auto size-[180px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={nonZero.length ? nonZero : [{ key: "none", label: "", value: 1, color: "var(--surface-2)" }]} dataKey="value" nameKey="label" innerRadius={58} outerRadius={84} paddingAngle={nonZero.length > 1 ? 2 : 0} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {(nonZero.length ? nonZero : [{ key: "none", color: "var(--surface-2)" }]).map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            {nonZero.length > 0 && <Tooltip content={<ChartTooltip fmt={(v) => String(v)} />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="tabular text-2xl font-semibold">{centerValue}</span>
          <span className="text-2xs text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="flex-1 text-muted">{d.label}</span>
            <span className="tabular font-semibold">{d.value}</span>
          </li>
        ))}
      </ul>
      <SrTable caption={caption} columns={["", "#"]} rows={data.map((d) => [d.label, d.value])} />
    </div>
  );
}
