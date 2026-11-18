import Link from "next/link";
import { deviceLabel, formatBytes, formatDateTime, formatSeconds, shortId } from "@/lib/format";

const ID_ICONS = { queued: "hourglass_top", processing: "schedule", failed: "error", cancelled: "block" };

function framesText(job) {
  if (job.media_type === "image") return "1 image";
  if (job.status === "processing") return `${job.frames_done} / ${job.frame_count ?? "?"} frames`;
  if (job.status === "completed") return `${job.frame_count} frames / ${formatSeconds(job.duration_ms)}`;
  return "—";
}

/** One row of the jobs table (plus an expandable failure-details row). */
export default function JobRow({ job, newestCompleted, expanded, onToggleDetails, onCancel, onDelete }) {
  const done = job.status === "completed";

  return (
    <>
      <tr className={`h-[54px] transition hover:bg-white/[0.04] ${done ? "bg-success-glow/[0.03]" : ""}`}>
        <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-medium">
          {done ? (
            <Link href={`/jobs/${job.job_id}`} title={job.job_id} className="flex items-center gap-1.5 transition hover:text-success-glow">
              <span className="icon text-[16px] text-white/60" aria-hidden="true">play_circle</span>
              {shortId(job.job_id)}
            </Link>
          ) : (
            <span title={job.job_id} className="flex items-center gap-1.5 text-white/90">
              <span className="icon text-[16px] text-white/60" aria-hidden="true">{ID_ICONS[job.status]}</span>
              {shortId(job.job_id)}
            </span>
          )}
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <span className={`icon text-[18px] ${done ? "text-success-glow" : "text-white/70"}`} aria-hidden="true">
              {job.media_type === "image" ? "image" : "movie"}
            </span>
            <span className="max-w-[14rem] truncate font-bold" title={job.filename}>{job.filename}</span>
            {job.same_file ? (
              <span title="Same file processed by another job" className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white/80">
                SAME FILE
              </span>
            ) : (
              <span className="font-mono text-white/60">{formatBytes(job.size_bytes)}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-2">
          <span className="whitespace-nowrap rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 font-mono font-bold">{job.model}</span>
        </td>
        <td className="px-4 py-2 font-mono text-white/90" title={job.device ?? undefined}>{deviceLabel(job.device)}</td>
        <td className="min-w-[200px] px-4 py-2"><StatusCell job={job} /></td>
        <td className="whitespace-nowrap px-4 py-2 font-mono text-white/80">{framesText(job)}</td>
        <td className="whitespace-nowrap px-4 py-2 font-mono text-white/60">{formatDateTime(job.created_at)}</td>
        <td className="px-4 py-2">
          <div className="flex items-center justify-end gap-1.5">
            <Actions job={job} newestCompleted={newestCompleted} expanded={expanded}
              onToggleDetails={onToggleDetails} onCancel={onCancel} onDelete={onDelete} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-black/40 px-4 py-3 font-mono text-xs text-white/80">
            <span className="font-bold text-white">Error:</span> {job.error_code} — {job.error}
          </td>
        </tr>
      )}
    </>
  );
}

function StatusCell({ job }) {
  if (job.status === "processing") {
    const percent = Math.round(job.progress * 100);
    return (
      <div className="flex w-44 flex-col gap-1">
        <div className="flex items-center justify-between font-mono text-[11px] font-bold">
          <span className="flex items-center gap-1 text-white/80">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
            Processing
          </span>
          <span>{percent}%</span>
        </div>
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  if (job.status === "completed") {
    return (
      <Pill className="border-success-glow/40 bg-success-glow/20 font-bold text-success-glow">
        <span className="h-1.5 w-1.5 rounded-full bg-success-glow" />Completed
      </Pill>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="flex flex-col gap-0.5">
        <Pill className="w-max border-white/20 bg-white/10 font-bold text-white/90">
          <span className="icon text-[13px] text-white/70" aria-hidden="true">warning</span>Failed
        </Pill>
        <span className="text-[11px] font-medium text-white/60">Reason: {job.error}</span>
      </div>
    );
  }
  return (
    <Pill className="border-white/20 bg-white/10 font-medium text-white/80">
      <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
      {job.status === "queued" ? "Queued" : "Cancelled"}
    </Pill>
  );
}

function Pill({ className, children }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs ${className}`}>{children}</span>;
}

function Actions({ job, newestCompleted, expanded, onToggleDetails, onCancel, onDelete }) {
  if (job.status === "processing") {
    return <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/60">In progress</span>;
  }
  if (job.status === "queued") return <RoundButton icon="close" label="Cancel queued job" onClick={onCancel} />;
  return (
    <>
      {job.status === "completed" && (
        <Link
          href={`/jobs/${job.job_id}`}
          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition ${
            newestCompleted ? "border-white/20 bg-success-glow hover:bg-success" : "border-white/15 bg-white/10 hover:bg-white/20"
          }`}
        >
          Inspect
          {newestCompleted && <span className="icon text-[14px]" aria-hidden="true">chevron_right</span>}
        </Link>
      )}
      {job.status === "failed" && (
        <button type="button" onClick={onToggleDetails} aria-expanded={expanded}
          className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold transition hover:bg-white/20">
          <span className="icon text-[14px]" aria-hidden="true">error</span>
          Details
        </button>
      )}
      <RoundButton icon="delete" label="Delete job" onClick={onDelete} />
    </>
  );
}

function RoundButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
      <span className="icon text-[15px]" aria-hidden="true">{icon}</span>
    </button>
  );
}
