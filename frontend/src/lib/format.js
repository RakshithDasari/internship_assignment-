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

/** "xpu:0" -> "GPU", "cpu" -> "CPU" (the exact device stays available as a tooltip). */
export function deviceLabel(device) {
  if (!device) return "—";
  return device.startsWith("cpu") ? "CPU" : "GPU";
}

/** 5000 -> "05.00s" */
export const formatSeconds = (ms) => `${(ms / 1000).toFixed(2).padStart(5, "0")}s`;

/** Worker start to finish (timestamps have 1 s resolution): "39 s", "2 m 05 s", or null. */
export function processingTime(job) {
  if (!job.started_at || !job.completed_at) return null;
  const seconds = Math.max(1, Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} m ${String(seconds % 60).padStart(2, "0")} s`;
}

/** ISO UTC timestamp -> "Today, 14:31:16" or "17 Nov, 14:31" in the viewer's time zone. */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  if (date.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time.slice(0, 5)}`;
}
