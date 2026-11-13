import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />)}
      </div>
      <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
    </div>
  );
}
