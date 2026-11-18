import { metadataUrl, resultUrl } from "@/lib/api";
import { deviceLabel } from "@/lib/format";

/** File name, model/device and a media summary, plus the two download links above each dashboard. */
export default function FileBar({ job, summary, outputLabel }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" title={job.filename}>{job.filename}</p>
        <p className="text-xs text-white/60">
          {job.model} · {deviceLabel(job.device)} · {summary}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <DownloadLink href={resultUrl(job.job_id, true)} icon="download" label={`Download ${outputLabel}`} />
        <DownloadLink href={metadataUrl(job.job_id, true)} icon="data_object" label="Metadata (JSON)" />
      </div>
    </div>
  );
}

function DownloadLink({ href, icon, label }) {
  return (
    <a href={href} className="pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold">
      <span className="icon text-[15px]" aria-hidden="true">{icon}</span>
      {label}
    </a>
  );
}
