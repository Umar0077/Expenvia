"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { X, ArrowUpRight } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform, type MotionStyle } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { ExpenviaLogo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/preferences/language-switcher";
import { ThemeToggle } from "@/components/preferences/theme-toggle";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { duration, ease, spring } from "@/lib/motion";
import "./liquid-glass-navigation.css";

const sections = ["capabilities", "workflow", "security"] as const;

export function ExecutiveAppBar() {
  const t = useTranslations("landing"), nav = useTranslations("nav");
  const locale = useLocale(), reduced = useReducedMotion();
  const [open, setOpen] = useState(false), [active, setActive] = useState("");
  const [hovered, setHovered] = useState<string | null>(null), [focused, setFocused] = useState<string | null>(null);
  const highlighted = hovered ?? focused ?? active;
  const groupId = useId();
  const selectedSection = useRef<string | null>(null);
  const { scrollY } = useScroll();
  const progress = useSpring(useTransform(scrollY, [0, 160], [0, 1]), spring.panel);
  const fill = useTransform(progress, [0, 1], [.72, .92]);
  const depth = useTransform(progress, [0, 1], [.22, .40]);
  const lightTargetX = useMotionValue(0), lightTargetY = useMotionValue(0), lightTargetOpacity = useMotionValue(0);
  const lightX = useSpring(lightTargetX, spring.panel), lightY = useSpring(lightTargetY, spring.panel), lightOpacity = useSpring(lightTargetOpacity, spring.panel);
  const light = useMotionTemplate`radial-gradient(260px circle at ${lightX}px ${lightY}px, rgb(var(--glass-edge) / .36), transparent 72%)`;
  const labels = [t("navFeatures"), t("navWorkflow"), t("navSecurity")];
  useEffect(() => {
    const nodes = sections.map(id => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(entries => {
      const entered = entries.find(entry => entry.isIntersecting);
      if (entered) setActive(entered.target.id);
      else setActive(current => entries.some(entry => entry.target.id === current) ? "" : current);
    }, { rootMargin: "-20% 0px -55% 0px", threshold: 0 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return <header className="executive-header liquid-glass" data-reduced={reduced}>
    <motion.div className="executive-bar" style={reduced ? undefined : { "--glass-progress": progress, "--glass-fill": fill, "--glass-depth": depth } as MotionStyle}
      onPointerMove={event => {
        if (reduced || event.pointerType !== "mouse" || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        lightTargetX.set(event.clientX - bounds.left); lightTargetY.set(event.clientY - bounds.top); lightTargetOpacity.set(.8);
      }} onPointerLeave={() => lightTargetOpacity.set(0)}>
      <span className="glass-material" aria-hidden="true"><motion.span className="glass-pointer" style={{ background: light, opacity: reduced ? 0 : lightOpacity }} /></span>
      <motion.div className="glass-brand-motion" whileHover={reduced ? undefined : { scale: 1.025 }} transition={spring.soft}>
        <Link href="/" aria-label="Expenvia" className="executive-brand"><ExpenviaLogo size="navigation" /></Link>
      </motion.div>
      <LayoutGroup id={groupId}><nav className="executive-links" aria-label={nav("primary")} onPointerLeave={() => setHovered(null)}>
        {sections.map((id, index) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className="executive-link" data-highlighted={highlighted === id}
          onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(id); }} onFocus={() => setFocused(id)} onBlur={() => setFocused(null)}>
          {highlighted === id && <motion.span className="glass-link-highlight" layoutId="liquid-glass-indicator" initial={false} transition={reduced ? { duration: 0 } : spring.soft}>
            <motion.span className="glass-link-light" initial={false} animate={{ scaleX: reduced ? 1 : [.97, 1.04, 1] }} transition={{ duration: reduced ? 0 : duration.panel, ease: ease.out }} />
          </motion.span>}
          <span>{labels[index]}</span>
        </a>)}
      </nav></LayoutGroup>
      <div className="executive-controls">
        <div className="executive-preferences"><span className="executive-desktop-control"><LanguageSwitcher /></span><ThemeToggle /></div>
        <Button asChild variant="ghost" className="executive-signin executive-desktop-control"><Link href="/login">{t("signIn")}</Link></Button>
        <motion.div className="glass-access-wrap" whileHover={reduced ? undefined : { y: -2 }} transition={spring.soft}>
          <Button asChild className="executive-access"><Link href="/signup">{t("getStarted")}<ArrowUpRight aria-hidden="true" className="rtl:-scale-x-100" /></Link></Button>
        </motion.div>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild><Button variant="ghost" size="icon" className="executive-menu-trigger" aria-label={nav("openMenu")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <motion.path animate={{ d: open ? "M6 6 L18 18" : "M5 7 L19 7" }} transition={{ duration: reduced ? 0 : duration.standard }} />
              <motion.path d="M5 12 L19 12" animate={{ opacity: open ? 0 : 1 }} transition={{ duration: reduced ? 0 : duration.micro }} />
              <motion.path animate={{ d: open ? "M6 18 L18 6" : "M5 17 L19 17" }} transition={{ duration: reduced ? 0 : duration.standard }} />
            </svg>
          </Button></Dialog.Trigger>
          <AnimatePresence initial={false}>{open && <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount><motion.div className="executive-menu-overlay liquid-glass-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : duration.standard }} /></Dialog.Overlay>
            <Dialog.Content asChild forceMount className="executive-menu liquid-glass-menu" dir={locale === "ur" ? "rtl" : "ltr"} aria-describedby={undefined}
              onCloseAutoFocus={event => {
                if (!selectedSection.current) return;
                event.preventDefault();
                const heading = document.querySelector<HTMLElement>(`#${selectedSection.current} h2`);
                heading?.setAttribute("tabindex", "-1"); heading?.focus({ preventScroll: true });
                selectedSection.current = null;
              }}><motion.div data-reduced={reduced} initial={reduced ? false : { opacity: 0, y: -8, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={reduced ? { duration: 0 } : { duration: duration.panel, ease: ease.out }}>
              <div className="executive-menu-heading"><Dialog.Title>{nav("primary")}</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={nav("closeMenu")}><X /></Button></Dialog.Close></div>
              <nav aria-label={nav("primary")} className="executive-menu-links">{sections.map((id, index) => <Dialog.Close key={id} asChild><a href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => { selectedSection.current = id; }}><span>{labels[index]}</span><ArrowUpRight size={18} aria-hidden="true" className="rtl:-scale-x-100" /></a></Dialog.Close>)}</nav>
              <div className="executive-menu-preferences"><LanguageSwitcher /><ThemeToggle /></div>
              <div className="executive-menu-actions"><Button asChild variant="secondary"><Link href="/login">{t("signIn")}</Link></Button><Button asChild className="glass-menu-access"><Link href="/signup">{t("getStarted")}</Link></Button></div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>}</AnimatePresence>
        </Dialog.Root>
      </div>
    </motion.div>
  </header>;
}
