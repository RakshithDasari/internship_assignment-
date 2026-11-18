import { useEffect, useState } from "react";
import { getHealth, getJob, liveUrl } from "@/lib/api";

const HEALTH_INTERVAL_MS = 10_000;
const JOB_POLL_MS = 1_000;
export const FINISHED = new Set(["completed", "failed", "cancelled"]);

/**
 * Calls `load` now and then every `intervalMs` while the tab is visible.
 * Waits for each request to finish before scheduling the next, so slow responses never pile up.
 * `load` must be a stable function (module-level or memoised).
 */
export function usePolling(load, intervalMs, enabled = true) {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer;

    async function tick() {
      if (!document.hidden) {
        try {
          const data = await load();
          if (!cancelled) setState({ data, error: null });
        } catch (error) {
          if (!cancelled) setState((previous) => ({ data: previous.data, error }));
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, intervalMs, enabled]);

  return state;
}

/** Live backend status for the header chip: { label, healthy, health }. */
export function useHealth() {
  const { data, error } = usePolling(getHealth, HEALTH_INTERVAL_MS);
  if (error) return { label: "API offline", healthy: false, health: null };
  if (!data) return { label: "Checking…", healthy: false, health: null };
  if (data.redis !== "ok") return { label: "Redis offline", healthy: false, health: data };
  if (data.worker !== "ok") return { label: "Worker offline", healthy: false, health: data };
  return { label: "Redis / Celery Active", healthy: true, health: data };
}

/**
 * Follows one job until it finishes. Live updates (and annotated preview frames) arrive over
 * the WebSocket; whenever the socket closes, for any reason, it falls back to polling, which
 * also fetches the final state once the job is done.
 * Returns { job, frame, error }: `frame` is the latest live frame event, if any.
 */
const NO_JOB = { jobId: null, job: null, frame: null, error: null };

export function useJob(jobId) {
  // State is tagged with the job it belongs to, so switching jobs never shows the previous one.
  const [state, setState] = useState(NO_JOB);

  useEffect(() => {
    if (!jobId) return undefined;
    let stopped = false;
    let pollTimer;
    // `change` receives this job's current state and returns the fields to update.
    const update = (change) =>
      setState((current) => {
        const mine = current.jobId === jobId ? current : { ...NO_JOB, jobId };
        return { ...mine, ...change(mine) };
      });

    async function poll() {
      try {
        const latest = await getJob(jobId);
        if (stopped) return;
        update(() => ({ job: latest, error: null }));
        if (!FINISHED.has(latest.status)) pollTimer = setTimeout(poll, JOB_POLL_MS);
      } catch (err) {
        if (stopped) return;
        update(() => ({ error: err }));
        if (err.status !== 404) pollTimer = setTimeout(poll, JOB_POLL_MS);
      }
    }

    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot" && message.job) {
        update(() => ({ job: message.job }));
      } else if (message.type === "frame") {
        update(({ job }) => ({
          frame: message,
          job: job && {
            ...job,
            frames_done: message.frames_done,
            frame_count: message.frame_count ?? job.frame_count,
            progress: message.frame_count ? Math.min(message.frames_done / message.frame_count, 0.99) : job.progress,
          },
        }));
      } else if (message.type === "status") {
        update(({ job }) => ({ job: job && { ...job, status: message.status, device: message.device ?? job.device } }));
      }
    }

    const socket = new WebSocket(liveUrl(jobId));
    socket.onmessage = onMessage;
    socket.onclose = () => {
      if (!stopped) poll(); // job ended, server restarted or socket unsupported: polling takes over
    };

    return () => {
      stopped = true;
      clearTimeout(pollTimer);
      socket.close();
    };
  }, [jobId]);

  return state.jobId === jobId ? state : { ...NO_JOB, jobId };
}
