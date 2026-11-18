"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ErrorBanner from "@/components/ErrorBanner";
import { HealthChip } from "@/components/Header";
import ImageDashboard from "@/components/ImageDashboard";
import JobProgress from "@/components/upload/JobProgress";
import VideoDashboard from "@/components/VideoDashboard";
import { getMetadata } from "@/lib/api";
import { deviceLabel } from "@/lib/format";
import { useJob } from "@/lib/hooks";

export default function JobPage() {
  const { id } = useParams();
  // Keyed by id: opening another job starts from a clean state.
  return <JobView key={id} jobId={id} />;
}

function JobView({ jobId }) {
  const { job, frame, error } = useJob(jobId);
  const [metadata, setMetadata] = useState(null);
  const [metadataError, setMetadataError] = useState(null);
  const completed = job?.status === "completed";

  useEffect(() => {
    if (!completed) return;
    getMetadata(jobId).then(setMetadata).catch(setMetadataError);
  }, [completed, jobId]);

  const chip = job && (
    <HealthChip>
      Model: {job.model} • {job.media_type === "image" ? "Still Image" : `${deviceLabel(job.device)} Host`}
    </HealthChip>
  );

  return (
    <AppShell chip={chip}>
      {metadata && job.media_type === "video" && <VideoDashboard job={job} metadata={metadata} />}
      {metadata && job.media_type === "image" && <ImageDashboard job={job} metadata={metadata} />}
      {!metadata && (
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex w-full max-w-2xl flex-col gap-4">
            <Status job={job} frame={frame} error={error ?? metadataError} />
          </div>
        </main>
      )}
    </AppShell>
  );
}

/** Everything that isn't a finished dashboard: loading, not found, still processing, failed. */
function Status({ job, frame, error }) {
  if (error?.status === 404) {
    return (
      <>
        <ErrorBanner title="Job not found." detail="It may have been deleted." />
        <BackToJobs />
      </>
    );
  }
  if (error) return <ErrorBanner title={error.message} />;
  if (!job) return <p className="text-center text-sm text-white/60">Loading job…</p>;
  if (job.status === "completed") return <p className="text-center text-sm text-white/60">Loading results…</p>;
  return (
    <>
      <JobProgress job={job} frame={frame} />
      {job.status !== "queued" && job.status !== "processing" && <BackToJobs />}
    </>
  );
}

function BackToJobs() {
  return (
    <Link href="/jobs" className="self-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/20">
      Back to Jobs
    </Link>
  );
}
