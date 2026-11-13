"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
export type AtelierVariant="surface"|"metric"|"branch"|"vendor"|"invoice"|"chart";
export function AtelierCard({children,className,variant="surface",interactive=false}:{children:React.ReactNode;className?:string;variant?:AtelierVariant;interactive?:boolean}) {
 const reduced=useReducedMotion();
 return <motion.div className={cn("surface-card atelier-card",`atelier-${variant}`,className)} data-elevation={interactive?"2":"1"} whileHover={interactive&&!reduced?{y:-3}:undefined} transition={{type:"spring",stiffness:260,damping:28}}>{children}</motion.div>;
}
export function AtelierBentoGrid({children,className}:{children:React.ReactNode;className?:string}) {return <div className={cn("atelier-bento",className)}>{children}</div>;}
export function AtelierChartPanel({children,className}:{children:React.ReactNode;className?:string}) {return <AtelierCard variant="chart" className={className}>{children}</AtelierCard>;}
