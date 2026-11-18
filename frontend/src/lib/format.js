const UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes) {
  if (bytes == null) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${UNITS[unit]}`;
}

/** "3c8dd2b5eefe…" -> "job-3c8dd2b" (the short form used across the UI). */
export const shortId = (jobId) => `job-${jobId.slice(0, 7)}`;

/** 1667 -> "00:01.667" */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

/** 5000 -> "05.00s" */
export const formatSeconds = (ms) => `${(ms / 1000).toFixed(2).padStart(5, "0")}s`;

/** ISO UTC timestamp -> "Today, 14:31:16" or "17 Nov, 14:31" in the viewer's time zone. */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  if (date.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time.slice(0, 5)}`;
}
