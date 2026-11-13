"use client";
import { useEffect, useId, useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
export type AmbientVariant = "hero" | "auth" | "panel" | "app" | "static";
export function FluidAuroraCanvas({variant,className}:{variant:AmbientVariant;className?:string}) {
 const ref=useRef<HTMLDivElement>(null), id=useId().replace(/:/g, "");
 const reduced=useReducedMotion();
 const px=useMotionValue(0),py=useMotionValue(0);
 const x=useSpring(px,{stiffness:35,damping:22}),y=useSpring(py,{stiffness:35,damping:22});
 const backX=useTransform(x,v=>v*-.45);
 const {scrollYProgress}=useScroll();
 const scrollRotate=useTransform(scrollYProgress,[0,1],[-3,5]);
 const interactive=variant==="hero" && !reduced;
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  let visible=true;
  const sync=()=>el.toggleAttribute("data-paused",document.hidden || !visible);
  const io=new IntersectionObserver(([entry])=>{visible=!!entry?.isIntersecting;sync();});io.observe(el);
  document.addEventListener("visibilitychange",sync);sync();
  const reset=()=>{px.set(0);py.set(0);};
  const move=(e:PointerEvent)=>{if(document.hidden || !visible || e.pointerType!=="mouse")return;px.set((e.clientX/innerWidth-.5)*24);py.set((e.clientY/innerHeight-.5)*18);};
  const fine=interactive && matchMedia("(hover: hover) and (pointer: fine)").matches;
  if(fine){window.addEventListener("pointermove",move,{passive:true});document.documentElement.addEventListener("pointerleave",reset);}
  if(!interactive)reset();
  return()=>{io.disconnect();document.removeEventListener("visibilitychange",sync);window.removeEventListener("pointermove",move);document.documentElement.removeEventListener("pointerleave",reset);};
 },[interactive,px,py]);
 return <div ref={ref} aria-hidden="true" data-variant={variant} data-reduced={reduced || undefined} className={cn("fluid-aurora",className)}>
  <motion.div className="aurora-field" style={interactive?{x:backX,rotate:scrollRotate}:undefined}/>
  <motion.div className="aurora-composition" style={interactive?{x,y}:undefined}>
   <svg className="aurora-ribbons" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
    <defs>
     <linearGradient id={`${id}emerald`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--aurora-deep)"/><stop offset=".45" stopColor="var(--aurora-green)"/><stop offset=".65" stopColor="var(--aurora-light)"/><stop offset="1" stopColor="var(--aurora-deep)"/></linearGradient>
     <linearGradient id={`${id}copper`} x1="0" y1="0" x2="1" y2=".7"><stop stopColor="#84553e"/><stop offset=".35" stopColor="#c47b56"/><stop offset=".52" stopColor="#f4dbc4"/><stop offset=".7" stopColor="#c47b56"/><stop offset="1" stopColor="#835940"/></linearGradient>
     <linearGradient id={`${id}silk`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--aurora-light)" stopOpacity=".5"/><stop offset="1" stopColor="var(--aurora-deep)" stopOpacity=".1"/></linearGradient>
     <filter id={`${id}grain`}><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    </defs>
    <g className="aurora-wave aurora-wave-back">
     <path d="M-160 210 C240 760 520 720 830 330 S1370 -80 1770 140 L1780 -120 L-180 -100Z" fill={`url(#${id}emerald)`}/>
     <path d="M-100 120 C280 660 540 690 870 260 S1400 -90 1730 100" fill="none" stroke="var(--aurora-light)" strokeOpacity=".35" strokeWidth="2"/>
    </g>
    <g className="aurora-wave aurora-wave-front">
     <path d="M-180 530 C300 230 550 1000 1010 620 S1500 360 1810 530 L1800 1160 L-180 1140Z" fill={`url(#${id}silk)`}/>
     <path d="M-180 570 C300 270 550 1040 1010 660 S1500 400 1810 570" fill="none" stroke={`url(#${id}copper)`} strokeWidth="38"/>
     <path d="M-180 548 C300 248 550 1018 1010 638 S1500 378 1810 548" fill="none" stroke="var(--aurora-light)" strokeWidth="3" opacity=".7"/>
    </g>
    <path d="M-100 830 Q700 200 1700 850 M-100 850 Q700 220 1700 870" fill="none" stroke="var(--aurora-light)" strokeOpacity=".18"/>
    <rect width="1600" height="1000" filter={`url(#${id}grain)`} opacity=".035"/>
   </svg>
  </motion.div><div className="aurora-vignette"/>
 </div>;
}
export const AmbientBackground=FluidAuroraCanvas;
