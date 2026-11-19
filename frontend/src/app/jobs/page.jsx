"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import ErrorBanner from "@/components/ErrorBanner";
import JobRow from "@/components/jobs/JobRow";
import { cancelJob, deleteJob, listJobs } from "@/lib/api";
import { usePolling } from "@/lib/hooks";

const POLL_MS = 4_000;
const PAGE_SIZE = 20;
const STATUSES = ["queued", "processing", "completed", "failed", "cancelled"];
const COLUMNS = ["File", "Model", "Status", "Length", "Created"];

export default function JobsPage() {
  const { data: jobs, error, refresh } = usePolling(listJobs, POLL_MS);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [model, setModel] = useState("all");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const all = jobs ?? [];
  const search = query.trim().toLowerCase();
  const visible = all.filter(
    (job) =>
      (status === "all" || job.status === status) &&
      (model === "all" || job.model === model) &&
      (!search || job.job_id.includes(search) || job.filename.toLowerCase().includes(search)),
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const newestCompleted = all.find((job) => job.status === "completed")?.job_id;
  const models = [...new Set(all.map((job) => job.model))].sort();
  const count = (...states) => all.filter((job) => states.includes(job.status)).length;

  async function run(action, message) {
    if (message && !window.confirm(message)) return;
    try {
      setActionError(null);
      await action();
      refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  function filterBy(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(0);
    };
  }

  return (
    <AppShell className="screen-jobs">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl">
                <span className="font-light text-white/80">Jobs</span> <span className="font-bold">History</span>
              </h1>
              <p className="mt-1 text-sm text-white/60">Every inference job, newest first.</p>
            </div>
            <Link href="/upload" className="flex items-center gap-1.5 self-start rounded-full bg-white px-5 py-2 text-xs font-bold text-black transition hover:bg-white/90 active:scale-[0.97] sm:self-auto">
              <span className="icon text-[16px]" aria-hidden="true">add</span>
              New upload
            </Link>
          </div>

          <dl className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <Stat label="Total Jobs" value={all.length} />
            <Stat label="Completed" value={count("completed")} className="text-success-glow" />
            <Stat label="Processing / Queued" value={count("processing", "queued")} />
            <Stat label="Failed" value={count("failed")} className="text-white/80" />
          </dl>

          {error && <ErrorBanner title="Can't load jobs." detail={error.message} />}
          {actionError && <ErrorBanner title={actionError} onDismiss={() => setActionError(null)} />}

          <div className="flex flex-col overflow-hidden rounded-[22px] border border-white/10 bg-black/40">
            <div className="flex flex-col-reverse gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
                {["all", ...STATUSES].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => {
                      setStatus(value);
                      setPage(0);
                    }}
                    className={`pill px-3.5 py-1 text-xs ${status === value ? "pill-active" : ""}`}
                  >
                    {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 lg:w-60 lg:flex-none">
                  <span className="icon absolute left-3 top-2 text-[17px] text-white/50" aria-hidden="true">search</span>
                  <input
                    type="search"
                    value={query}
                    onChange={filterBy(setQuery)}
                    placeholder="Search files or job IDs"
                    aria-label="Search jobs by file name or ID"
                    className="w-full rounded-full border border-white/12 bg-black/40 py-1.5 pl-9 pr-3 text-xs placeholder:text-white/40"
                  />
                </div>
                <select aria-label="Filter by model" value={model} onChange={filterBy(setModel)}
                  className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-xs">
                  <option value="all">All models</option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    {COLUMNS.map((column) => (
                      <th key={column} scope="col" className="px-4 py-3 font-medium">{column}</th>
                    ))}
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {rows.map((job) => (
                    <JobRow
                      key={job.job_id}
                      job={job}
                      newestCompleted={job.job_id === newestCompleted}
                      expanded={expandedId === job.job_id}
                      onToggleDetails={() => setExpandedId((id) => (id === job.job_id ? null : job.job_id))}
                      onCancel={() => run(() => cancelJob(job.job_id))}
                      onDelete={() => run(() => deleteJob(job.job_id), `Delete ${job.filename} and its results?`)}
                    />
                  ))}
                  {jobs && rows.length === 0 && <EmptyRow />}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/50">
              <span>{visible.length} {visible.length === 1 ? "job" : "jobs"}</span>
              {pageCount > 1 && (
                <nav aria-label="Pagination" className="flex items-center gap-2">
                  <PageButton icon="chevron_left" label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} />
                  <span aria-current="page">Page {currentPage + 1} of {pageCount}</span>
                  <PageButton icon="chevron_right" label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} />
                </nav>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function Stat({ label, value, className = "" }) {
  return (
    <div className="dark-glass-card flex flex-col rounded-2xl p-4">
      <dt className="text-xs font-medium text-white/60">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold ${className}`}>{value}</dd>
    </div>
  );
}

function PageButton({ icon, label, disabled, onClick }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="icon-btn h-8 w-8">
      <span className="icon text-[16px]" aria-hidden="true">{icon}</span>
    </button>
  );
}

function EmptyRow() {
  return (
    <tr>
      <td colSpan={6} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="icon text-[36px] text-white/30" aria-hidden="true">inbox</span>
          <p className="text-sm font-semibold text-white/80">No inference jobs found</p>
          <p className="text-xs text-white/60">Try clearing your search or upload a new file.</p>
          <Link href="/upload" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-white/90">
            <span className="icon text-[16px]" aria-hidden="true">cloud_upload</span>
            Upload
          </Link>
        </div>
      </td>
    </tr>
  );
}
