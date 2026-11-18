import { metadataUrl, resultUrl } from "@/lib/api";

/** File name, a short media summary and the two download links above each dashboard. */
export default function FileBar({ job, summary, outputLabel }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-white/80">File:</span>
        <span className="max-w-[18rem] truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 font-mono font-semibold" title={job.filename}>
          {job.filename}
        </span>
        <span className="font-mono text-white/60">{summary}</span>
      </p>
      <div className="flex items-center gap-2">
        <DownloadLink href={resultUrl(job.job_id, true)} icon="download" iconClass="text-scarlet" label={`Download ${outputLabel}`} />
        <DownloadLink href={metadataUrl(job.job_id, true)} icon="data_object" iconClass="text-white/70" label="Download metadata (JSON)" />
      </div>
    </div>
  );
}

function DownloadLink({ href, icon, iconClass, label }) {
  return (
    <a
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold shadow-sm transition hover:bg-white/20"
    >
      <span className={`icon text-[15px] ${iconClass}`} aria-hidden="true">{icon}</span>
      {label}
    </a>
  );
}
