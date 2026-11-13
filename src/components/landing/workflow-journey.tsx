"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3, Check, FileSpreadsheet, ReceiptText, ShieldCheck, ArrowUpRight } from "lucide-react";
import { motion, useInView, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import "./workflow-journey.css";

type Point = { x: number; y: number };
type Geometry = { width: number; height: number; points: Point[]; segments: string[]; path: string };
const icons = [ReceiptText, FileSpreadsheet, ShieldCheck, BarChart3];
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** All paths and activation thresholds derive from the actual, untransformed markers. */
function measureGeometry(canvas: HTMLDivElement): Geometry {
  const rect = canvas.getBoundingClientRect();
  const points = Array.from(canvas.querySelectorAll<HTMLElement>(".journey-anchor")).map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 };
  });
  const mobile = getComputedStyle(canvas).getPropertyValue("--journey-layout").trim() === "mobile";
  const rtl = getComputedStyle(canvas).direction === "rtl";
  const segments = points.slice(1).map((b, i) => {
    const a = points[i]!;
    if (mobile) {
      const bend = (i % 2 ? -1 : 1) * (rtl ? -1 : 1) * 28;
      return `M${a.x},${a.y} C${a.x + bend},${a.y + (b.y - a.y) * .36} ${b.x - bend},${b.y - (b.y - a.y) * .36} ${b.x},${b.y}`;
    }
    if (Math.abs(b.x - a.x) < 1) {
      const bend = (rtl ? -1 : 1) * 46;
      return `M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x + bend},${b.y} ${b.x},${b.y}`;
    }
    const mid = (a.x + b.x) / 2;
    const wave = Math.abs(a.y - b.y) < 1 ? (i === 0 ? 24 : -24) : 0;
    return `M${a.x},${a.y} C${mid},${a.y + wave} ${mid},${b.y - wave} ${b.x},${b.y}`;
  });
  return { width: rect.width, height: rect.height, points, segments, path: segments.map((s, i) => i ? s.replace(/^M[^ ]+ /, "") : s).join(" ") };
}

function WorkflowParticle({ x, y }: { x: MotionValue<number>; y: MotionValue<number> }) {
  return <motion.g className="journey-particle" style={{ x, y }}>
    <circle r="9" fill="var(--brand)" opacity=".12" />
    <circle r="4" fill="var(--brand)" />
    <circle r="1.8" fill="var(--surface)" />
  </motion.g>;
}

function WorkflowPath({ geometry, progress, reduced, visible, selected, onThresholds }: {
  geometry: Geometry; progress: MotionValue<number>; reduced: boolean; visible: boolean; selected: number | null; onThresholds: (values: number[]) => void;
}) {
  const id = useId();
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const length = useRef(0);
  const x = useMotionValue(0), y = useMotionValue(0);
  const position = useCallback((value: number) => {
    if (!pathRef.current || !length.current) return;
    const p = pathRef.current.getPointAtLength(clamp(value) * length.current);
    x.set(p.x); y.set(p.y);
  }, [x, y]);
  useLayoutEffect(() => {
    length.current = pathRef.current?.getTotalLength() ?? 0;
    const lengths = Array.from(svgRef.current?.querySelectorAll<SVGPathElement>(".journey-segment") ?? []).map(p => p.getTotalLength());
    const total = lengths.reduce((sum, n) => sum + n, 0);
    let sum = 0;
    onThresholds([0, ...lengths.map(n => { sum += n; return sum / total; })]);
    position(progress.get());
  }, [geometry, onThresholds, position, progress]);
  useMotionValueEvent(progress, "change", value => { if (visible && !reduced) position(value); });
  useEffect(() => { if (visible) position(progress.get()); }, [visible, position, progress]);
  return <svg ref={svgRef} className="journey-path" viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-flow`} gradientUnits="userSpaceOnUse" x1={geometry.points[0]!.x} y1={geometry.points[0]!.y} x2={geometry.points[3]!.x} y2={geometry.points[3]!.y}>
      <stop stopColor="var(--brand)" /><stop offset=".47" stopColor="var(--copper)" /><stop offset="1" stopColor="var(--brand)" />
    </linearGradient></defs>
    <path className="journey-path-channel" d={geometry.path} fill="none" strokeWidth="12" />
    <path ref={pathRef} className="journey-path-base" d={geometry.path} fill="none" strokeWidth="1.5" />
    <motion.path className="journey-path-progress" d={geometry.path} fill="none" stroke={`url(#${id}-flow)`} strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: reduced ? 1 : progress }} />
    {geometry.segments.map((d, i) => <path key={i} className="journey-segment" d={d} fill="none" strokeWidth="3" stroke="var(--copper)" style={{ opacity: selected !== null && (selected === i || selected === i + 1) ? .8 : 0 }} />)}
    {!reduced && visible && <WorkflowParticle x={x} y={y} />}
  </svg>;
}

/** SSR fallback stays fully visible without JS; enhanced geometry replaces it after measurement. */
function StaticPath({ rtl }: { rtl: boolean }) {
  return <>
    <svg className="journey-fallback journey-fallback-desktop" viewBox="0 0 1000 112" preserveAspectRatio="none" aria-hidden="true"><path d={rtl ? "M875 24 C750 24 750 88 625 88 S500 24 375 24 S250 88 125 88" : "M125 24 C250 24 250 88 375 88 S500 24 625 24 S750 88 875 88"} /></svg>
    <svg className="journey-fallback journey-fallback-tablet" viewBox="0 0 1000 112" preserveAspectRatio="none" aria-hidden="true"><path d={rtl ? "M750 24 C500 48 500 0 250 24 C190 24 190 88 250 88 C500 64 500 112 750 88" : "M250 24 C500 48 500 0 750 24 C810 24 810 88 750 88 C500 64 500 112 250 88"} /></svg>
  </>;
}

function WorkflowIllustration({ index, active, reduced, visible }: { index: number; active: boolean; reduced: boolean; visible: boolean }) {
  const t = useTranslations("landing.journey");
  return <div className={`journey-illustration journey-illustration-${index}`} aria-hidden="true">
    <motion.div className="journey-miniature" initial={false} animate={active && !reduced && visible ? { y: [3, -2, 0] } : { y: 0 }} transition={{ duration: reduced ? 0 : .45 }}>
      {index === 0 && <><div className="journey-document"><i /><i /><i /><span><Check size={11} /></span></div><div className="journey-mini-lines"><i /><i /><span>{t("receipt")}</span></div></>}
      {index === 1 && <><div className="journey-invoice-lines">{[0, 1, 2].map(n => <div key={n}><i /><span /><b /></div>)}</div><span className="journey-mini-caption">{t("assigned")}</span></>}
      {index === 2 && <><span className="journey-review-seal"><Check size={22} strokeWidth={1.5} /></span><div className="journey-mini-lines"><span>{t("context")}</span><span className="journey-review-status">{active ? t("reviewed") : t("review")}</span></div></>}
      {index === 3 && <><div className="journey-chart">{[.35, .65, .48, .82, 1].map((v, i) => <motion.i key={i} style={{ height: `${v * 100}%` }} initial={false} animate={{ scaleY: active ? 1 : .6 }} transition={{ duration: reduced || !visible ? 0 : .4, delay: reduced || !visible ? 0 : i * .04 }} />)}</div><div className="journey-mini-lines"><i /><span>{t("balances")}</span></div></>}
    </motion.div>
  </div>;
}

function WorkflowMilestone({ index, reached, selected, reduced, visible }: { index: number; reached: boolean; selected: boolean; reduced: boolean; visible: boolean }) {
  return <div className="journey-anchor" data-reached={reached} data-selected={selected} aria-hidden="true">
    <motion.span className="journey-anchor-shape" initial={false} animate={reached && !reduced && visible ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ duration: reduced ? 0 : .45 }}><span>{index + 1}</span></motion.span>
  </div>;
}

function WorkflowStepCard({ index, reached, selected, pinned, reduced, visible, onHover, onFocus, onToggle }: {
  index: number; reached: boolean; selected: boolean; pinned: boolean; reduced: boolean; visible: boolean;
  onHover: (value: boolean) => void; onFocus: (value: boolean) => void; onToggle: () => void;
}) {
  const t = useTranslations("landing");
  const Icon = icons[index] ?? ReceiptText;
  const active = reached || selected;
  return <motion.article className="journey-card" data-reached={reached} data-selected={selected} initial={false}
    animate={{ y: selected && !reduced ? -3 : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 25 }}
    onPointerEnter={e => { if (e.pointerType === "mouse") onHover(true); }} onPointerLeave={() => onHover(false)}>
    <div className="journey-card-top"><span className="journey-icon"><Icon size={23} strokeWidth={1.6} /></span><span className="journey-step-number" dir="ltr">0{index + 1}<span> / 04</span></span></div>
    <h3 id={`journey-title-${index}`}>{t(`step${index + 1}`)}</h3>
    <p id={`journey-body-${index}`}>{t(`step${index + 1}Body`)}</p>
    <WorkflowIllustration index={index} active={active} reduced={reduced} visible={visible} />
    <button type="button" className="journey-select" aria-label={t("journey.explore", { step: t(`step${index + 1}`) })} aria-describedby={`journey-body-${index}`} aria-pressed={pinned}
      onFocus={() => onFocus(true)} onBlur={() => onFocus(false)} onClick={onToggle} onKeyDown={e => { if (e.key === "Escape" && pinned) onToggle(); }}><span className="journey-explore-icon" aria-hidden="true"><ArrowUpRight size={14} /></span></button>
  </motion.article>;
}

export function WorkflowJourney() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const canvas = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const visible = useInView(canvas, { margin: "80px" });
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [thresholds, setThresholds] = useState([0, 1 / 3, 2 / 3, 1]);
  const [reached, setReached] = useState(4);
  const reachedRef = useRef(4);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const selected = hovered ?? focused ?? pinned;
  const { scrollYProgress } = useScroll({ target: canvas, offset: ["start 0.86", "end 0.7"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 150, damping: 30, mass: .5 });
  const progress = useTransform(smooth, clamp);
  const updateReached = useCallback((value: number) => {
    const count = reduced ? 4 : thresholds.filter(n => value >= Math.max(.004, n - .001)).length;
    if (reachedRef.current !== count) { reachedRef.current = count; setReached(count); }
  }, [reduced, thresholds]);
  useMotionValueEvent(progress, "change", updateReached);
  useEffect(() => { updateReached(progress.get()); }, [progress, updateReached]);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let frame = 0;
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setGeometry(measureGeometry(el))); };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.querySelectorAll(".journey-item").forEach(item => observer.observe(item));
    window.addEventListener("resize", measure);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [locale]);
  return <section id="workflow" className="workflow-journey scroll-mt-20" aria-labelledby="journey-heading">
    <div className="journey-aurora" aria-hidden="true" />
    <div className="journey-inner">
      <div className="journey-heading"><div><p className="journey-eyebrow"><span />{t("journey.eyebrow")}</p><h2 id="journey-heading" className="font-display">{t("workflowTitle")}</h2></div><p className="journey-intro">{t("workflowBody")}</p></div>
      <div className="journey-canvas" ref={canvas} data-ready={!!geometry} data-reduced={reduced}>
        <StaticPath rtl={locale === "ur"} />
        {geometry && <WorkflowPath geometry={geometry} progress={progress} reduced={reduced} visible={visible} selected={selected} onThresholds={setThresholds} />}
        <ol className="journey-steps">
          {[0, 1, 2, 3].map(index => <li key={index} className={`journey-item journey-item-${index}`}>
            <svg className="journey-fallback-mobile" viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden="true"><path d="M20 0 C39 36 1 64 20 100" /></svg>
            <WorkflowMilestone index={index} reached={reduced || index < reached} selected={index === selected} reduced={reduced} visible={visible} />
            <WorkflowStepCard index={index} reached={reduced || index < reached} selected={index === selected} pinned={index === pinned} reduced={reduced} visible={visible}
              onHover={value => setHovered(value ? index : null)} onFocus={value => setFocused(value ? index : null)} onToggle={() => setPinned(value => value === index ? null : index)} />
          </li>)}
        </ol>
      </div>
      <p className="journey-footnote"><ShieldCheck size={15} aria-hidden="true" />{t("journey.footnote")}</p>
    </div>
  </section>;
}
