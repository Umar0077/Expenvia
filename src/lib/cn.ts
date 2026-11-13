import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know our custom type-scale tokens (globals.css @theme);
 * otherwise `text-body` is mistaken for a text COLOR and silently removes
 * classes like `text-brand-fg` (e.g. white button labels).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["2xs", "body", "title", "section", "page", "page-lg", "metric"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
