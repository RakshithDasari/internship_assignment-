import Link from "next/link";
import { deviceLabel, formatBytes, formatDateTime, formatSeconds, shortId } from "@/lib/format";

function lengthText(job) {
  if (job.media_type === "image") return "Image";
  if (job.status === "processing") return `${job.frames_done} / ${job.frame_count ?? "?"} frames`;
  if (job.status === "completed") return `${formatSeconds(job.duration_ms)} · ${job.frame_count} frames`;
  return "—";
}

/** One row of the jobs table (plus an expandable failure-details row). */
export default function JobRow({ job, newestCompleted, expanded, onToggleDetails, onCancel, onDelete }) {
  const done = job.status === "completed";
  const name = (
    <span className="block max-w-[18rem] truncate font-semibold" title={job.filename}>{job.filename}</span>
  );

  return (
    <>
      <tr className="transition hover:bg-white/[0.04]">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={`icon text-[20px] ${done ? "text-success-glow" : "text-white/50"}`} aria-hidden="true">
              {job.media_type === "image" ? "image" : "movie"}
            </span>
            <div className="min-w-0">
              {done ? <Link href={`/jobs/${job.job_id}`} className="hover:underline">{name}</Link> : name}
              <span className="text-[11px] text-white/50">
                <span className="font-mono" title={job.job_id}>{shortId(job.job_id)}</span> · {formatBytes(job.size_bytes)}
                {job.same_file && <span title="The same file was processed by another job"> · same file</span>}
              </span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="block font-medium">{job.model}</span>
          <span className="text-[11px] text-white/50" title={job.device ?? undefined}>{deviceLabel(job.device)}</span>
        </td>
        <td className="px-4 py-3"><StatusCell job={job} /></td>
        <td className="whitespace-nowrap px-4 py-3 text-white/70">{lengthText(job)}</td>
        <td className="whitespace-nowrap px-4 py-3 text-white/50">{formatDateTime(job.created_at)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            <Actions job={job} newestCompleted={newestCompleted} expanded={expanded}
              onToggleDetails={onToggleDetails} onCancel={onCancel} onDelete={onDelete} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-black/40 px-4 py-3 text-xs text-white/80">
            <span className="font-semibold text-white">{job.error_code}:</span> {job.error}
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
      <div className="flex w-36 flex-col gap-1.5">
        <span className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Processing
          </span>
          <span className="text-white/60">{percent}%</span>
        </span>
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress"
          className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  const STYLES = {
    completed: ["bg-success-glow", "text-success-glow", "Completed"],
    failed: ["bg-scarlet", "text-white", "Failed"],
    queued: ["bg-white/40", "text-white/70", "Queued"],
    cancelled: ["bg-white/20", "text-white/50", "Cancelled"],
  };
  const [dot, text, label] = STYLES[job.status];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
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
          className={newestCompleted
            ? "rounded-full bg-success-glow px-3.5 py-1 text-xs font-semibold transition hover:bg-success"
            : "pill px-3.5 py-1 text-xs font-semibold"}
        >
          Inspect
        </Link>
      )}
      {job.status === "failed" && (
        <button type="button" onClick={onToggleDetails} aria-expanded={expanded} className="pill px-3.5 py-1 text-xs font-semibold">
          Details
        </button>
      )}
      <RoundButton icon="delete" label="Delete job" onClick={onDelete} />
    </>
  );
}

function RoundButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="icon-btn h-8 w-8">
      <span className="icon text-[15px]" aria-hidden="true">{icon}</span>
    </button>
  );
}
