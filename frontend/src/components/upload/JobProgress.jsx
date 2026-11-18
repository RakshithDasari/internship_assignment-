import Link from "next/link";
import { formatBytes, shortId } from "@/lib/format";

const STAGES = ["1. Uploading", "2. Queued", "3. Processing", "4. Completed"];

/** Turns the upload/job state into what the panel shows. */
function describe(upload, job) {
  if (!job) {
    const percent = upload.total ? Math.round((upload.loaded / upload.total) * 100) : 0;
    const rate = upload.bytesPerSecond ? `${formatBytes(upload.bytesPerSecond)}/s` : "starting…";
    return { stage: 0, title: "1. Uploading media...", value: `${percent}%`, bar: percent, barColor: "bg-scarlet",
      detail: `Transferring ${formatBytes(upload.total)} (${rate})` };
  }
  switch (job.status) {
    case "queued":
      return { stage: 1, title: "2. Queued in Celery worker pool...", value: "Waiting in queue", bar: 50, barColor: "bg-white/40",
        detail: job.queue_position ? `${job.queue_position} job(s) ahead of yours` : "Waiting for a worker" };
    case "processing": {
      const percent = Math.round(job.progress * 100);
      const detail = job.media_type === "video"
        ? `Frame ${job.frames_done} / ${job.frame_count ?? "?"} • ByteTrack active`
        : "Running inference";
      return { stage: 2, title: `3. Processing frames with ${job.model}...`, value: `${percent}%`, bar: percent,
        barColor: "bg-scarlet", detail };
    }
    case "completed":
      return { stage: 3, done: true, title: "4. Inference Completed", value: "100%", bar: 100, barColor: "bg-success-glow",
        detail: "Annotated output generated • Inference finished" };
    case "cancelled":
      return { stage: 1, stopped: true, title: "Job cancelled", value: "", bar: 0, barColor: "bg-white/40", detail: "Nothing was processed." };
    default:
      return { stage: 2, stopped: true, title: "Processing failed", value: "", bar: 100, barColor: "bg-white/40",
        detail: job.error ?? "Something went wrong." };
  }
}

function pillClass(index, view) {
  if (index < view.stage || view.done) return "bg-success-glow font-bold text-white";
  if (index > view.stage) return "bg-white/10 text-white/60";
  if (view.stopped || index === 1) return "bg-white/30 font-bold text-white"; // failed/cancelled, or waiting in queue
  return `bg-scarlet font-bold text-white ${index === 2 ? "animate-pulse" : ""}`;
}

/** The 4-stage lifecycle panel, with a live annotated preview while a video processes. */
export default function JobProgress({ upload, job, frame }) {
  const view = describe(upload, job);
  const live = job?.status === "processing" && frame?.preview;

  return (
    <section aria-live="polite" className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/60 p-4 shadow-xl">
      <div className="flex items-center justify-between text-xs">
        <h2 className="flex items-center gap-2 font-bold">
          <span className={`icon text-[18px] text-success-glow ${view.done || view.stopped ? "" : "animate-spin"}`} aria-hidden="true">
            {view.done ? "check_circle" : view.stopped ? "error" : "progress_activity"}
          </span>
          {view.title}
        </h2>
        <span className="font-mono font-bold">{view.value}</span>
      </div>

      <ol className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
        {STAGES.map((label, index) => (
          <li key={label} className={`rounded py-1 ${pillClass(index, view)}`}>{label}</li>
        ))}
      </ol>

      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.bar} aria-label="Job progress"
        className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all duration-300 ${view.barColor}`} style={{ width: `${view.bar}%` }} />
      </div>

      {live && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <img
            src={`data:image/jpeg;base64,${frame.preview}`}
            alt={`Live annotated frame ${frame.frame_index}`}
            className="aspect-video w-full rounded-xl border border-white/15 object-contain sm:w-2/3"
          />
          <dl className="flex flex-row gap-4 font-mono text-xs sm:flex-col">
            <div>
              <dt className="text-white/60">Objects</dt>
              <dd className="text-xl font-bold">{frame.total_objects}</dd>
            </div>
            <div>
              <dt className="text-white/60">Frame</dt>
              <dd className="text-xl font-bold">{frame.frame_index}</dd>
            </div>
            <div>
              <dt className="text-white/60">Stream</dt>
              <dd className="flex items-center gap-1.5 font-bold text-scarlet">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-scarlet" />LIVE
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-xs text-white/60">
        <span>{job ? `Job: ${shortId(job.job_id)}` : "Job: pending"}</span>
        <span>{view.detail}</span>
      </div>

      {view.done && (
        <div className="flex justify-end border-t border-white/10 pt-2">
          <Link href={`/jobs/${job.job_id}`}
            className="flex items-center gap-1.5 rounded-full bg-success-glow px-5 py-2 text-xs font-bold shadow-[0_0_15px_rgba(80,125,58,0.4)] hover:bg-success">
            Open dashboard
            <span className="icon text-[16px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      )}
    </section>
  );
}
