import { redirect } from "next/navigation";

/** Stable public URL for the capabilities overview (section on the landing page). */
export default function FeaturesPage() {
  redirect("/#capabilities");
}
