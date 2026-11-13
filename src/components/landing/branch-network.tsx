"use client";
import { motion } from "motion/react";
import { useLocale } from "next-intl";
import { Building2, GitMerge, MapPin } from "lucide-react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

// Approved public office identities; never fetch private branch/financial data here.
const OFFICES = [
 {code:"SHM",en:"Shamsabad Office",ur:"شمس آباد آفس",city:"Rawalpindi",cityUr:"راولپنڈی"},
 {code:"ISB",en:"Islamabad Office",ur:"اسلام آباد آفس",city:"Islamabad",cityUr:"اسلام آباد"},
 {code:"COM",en:"Commercial Office",ur:"کمرشل آفس",city:"Rawalpindi",cityUr:"راولپنڈی"},
 {code:"IRN",en:"Iran Road Office",ur:"ایران روڈ آفس",city:"Rawalpindi",cityUr:"راولپنڈی"},
 {code:"I92",en:"I-9/2 Office",ur:"آئی نائن ٹو آفس",city:"Islamabad",cityUr:"اسلام آباد"},
];
export function BranchNetwork() {
 const ur=useLocale()==="ur", reduced=useReducedMotion();
 return <div className="office-network">
  <div className="office-hub"><span className="office-hub-icon"><GitMerge className="size-5"/></span><div><p className="text-xs text-muted">{ur?"ایک مربوط نظام":"ONE CONNECTED WORKSPACE"}</p><h3 className="mt-1 text-section font-semibold">{ur?"مرکزی مالیاتی نگرانی":"Central financial oversight"}</h3></div><span className="office-count" aria-label={ur?"پانچ دفاتر":"Five offices"}>05</span></div>
  <svg className="office-connectors" viewBox="0 0 500 64" preserveAspectRatio="none" aria-hidden="true">
   {[50,150,250,350,450].map((x,i)=><motion.path key={x} d={`M250 0 V14 Q250 28 ${x} 28 V58`} fill="none" stroke={i===2?"var(--copper)":"var(--brand)"} strokeWidth="1.3" strokeOpacity=".45" initial={false} whileInView={{pathLength:1}} viewport={{once:true}} />)}
   {[50,150,250,350,450].map(x=><circle key={x} cx={x} cy="58" r="3" fill="var(--brand)"/>)}
  </svg>
  <ul className="office-grid">{OFFICES.map((office,i)=><motion.li key={office.code} className="office-card" initial={reduced?false:{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:reduced?0:.4,delay:reduced?0:i*.07}} whileHover={reduced?undefined:{y:-3}}>
   <div className="office-card-top"><Building2 className="size-5"/><span className="ltr-data text-xs">{office.code}</span></div>
   <h4 className="mt-3 text-title font-semibold">{ur?office.ur:office.en}</h4>
   {ur&&<p lang="en" dir="ltr" className="mt-1 text-xs text-muted">{office.en}</p>}
   <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-3.5 shrink-0"/>{ur?office.cityUr:office.city}</p>
  </motion.li>)}</ul>
 </div>;
}
