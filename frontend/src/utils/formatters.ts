export function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function focusKind(event: { category: "test" | "production" | "checkpoint" }): "test" | "production" | "mixed" {
  if (event.category === "checkpoint") return "mixed";
  return event.category;
}

export function metricHeatColor(score: number): [number, number, number] {
  if (score < 20) return [34, 197, 94]; // green
  if (score < 60) return [134, 239, 172]; // light green
  if (score < 70) return [250, 204, 21]; // amber
  if (score < 80) return [251, 146, 60]; // orange
  return [239, 68, 68]; // red
}

export function formatLocPace(locPerCycle: number): string {
  return `~${Math.round(locPerCycle)} LOC/cycle`;
}
