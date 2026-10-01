export const scoreColor = (score: number | null) =>
  score === null
    ? "bg-slate-700"
    : score >= 90
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-amber-400"
        : "bg-rose-500";
export const formatBytes = (bytes: number | null) =>
  bytes === null || !Number.isFinite(bytes)
    ? null
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${Math.round(bytes)} B`;

export const formatDelta = (value: number | null, suffix = "") =>
  value === null
    ? "—"
    : `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;

