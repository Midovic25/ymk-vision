import type { CSSProperties } from "react";

export type EntryStatus = "OK" | "NG" | "NA";

export const STATUS_META: Record<
  EntryStatus,
  { label: string; bg: string; fg: string; ring: string; symbol: string }
> = {
  OK: {
    label: "OK",
    bg: "bg-[var(--status-ok)]",
    fg: "text-[var(--status-ok-foreground)]",
    ring: "ring-[var(--status-ok)]",
    symbol: "●",
  },
  NG: {
    label: "NG",
    bg: "bg-[var(--status-ng)]",
    fg: "text-[var(--status-ng-foreground)]",
    ring: "ring-[var(--status-ng)]",
    symbol: "✕",
  },
  NA: {
    label: "NA",
    bg: "bg-[var(--status-na)]",
    fg: "text-[var(--status-na-foreground)]",
    ring: "ring-[var(--status-na)]",
    symbol: "▲",
  },
};

export function computeScore(counts: { OK: number; NG: number; NA: number }): number {
  const total = counts.OK + counts.NG + counts.NA;
  if (total === 0) return 0;
  return Math.round((counts.OK / total) * 1000) / 10;
}

export function statusStyle(status: EntryStatus): CSSProperties {
  return {};
}
