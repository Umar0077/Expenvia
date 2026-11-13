export const MOTION_COOKIE = "expenvia_motion";
export type MotionSetting = "full" | "reduced" | "system";

export function parseMotion(value: string | undefined): MotionSetting {
  return value === "full" || value === "reduced" ? value : "system";
}
