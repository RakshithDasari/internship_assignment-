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
const COLUMNS = ["Job ID", "Filename & Type", "Model Variant", "Device", "Status", "Frames / Duration", "Created", "Actions"];

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
      <main className="flex flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="dark-main-glass-box my-auto flex w-full max-w-6xl flex-col gap-6 rounded-[26px] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-2 sm:flex-row sm:items-center">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <span className="icon text-[24px] text-white/80" aria-hidden="true">list_alt</span>
                Jobs History
              </h1>
              <p className="mt-1 text-xs text-white/60">Asynchronous inference jobs, newest first.</p>
            </div>
            <Link href="/upload" className="flex items-center gap-1.5 self-start rounded-full border border-white/20 bg-white px-5 py-2 text-xs font-bold text-black shadow-md transition hover:bg-white/90 sm:self-auto">
              <span className="icon text-[16px]" aria-hidden="true">cloud_upload</span>
              Upload
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

          <div className="dark-glass-card flex flex-col overflow-hidden rounded-[22px] border border-white/10 shadow-xl">
            <div className="flex flex-col items-center justify-between gap-3 border-b border-white/10 bg-black/40 p-3.5 sm:flex-row">
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <span className="icon absolute left-3 top-2 text-[17px] text-white/60" aria-hidden="true">search</span>
                  <input
                    type="search"
                    value={query}
                    onChange={filterBy(setQuery)}
                    placeholder="Search by Job ID or file..."
                    aria-label="Search jobs by ID or file name"
                    className="w-full rounded-full border border-white/15 bg-black/50 py-1.5 pl-9 pr-3 font-mono text-xs shadow-inner placeholder:text-white/40"
                  />
                </div>
                <Select label="Filter by status" value={status} onChange={filterBy(setStatus)}
                  options={[["all", "All Statuses"], ...STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1)])]} />
                <Select label="Filter by model" value={model} onChange={filterBy(setModel)}
                  options={[["all", "All Models"], ...models.map((m) => [m, m])]} />
              </div>
              <p className="flex items-center gap-2 font-mono text-xs text-white/60">
                Poll interval:
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 font-bold text-white/80">{POLL_MS / 1000}s</span>
              </p>
            </div>

            <div className="overflow-x-auto bg-black/30">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="h-11 border-b border-white/10 bg-white/[0.02] font-mono uppercase tracking-wider text-white/60">
                    {COLUMNS.map((column) => (
                      <th key={column} scope="col" className={`px-4 py-2.5 font-normal ${column === "Actions" ? "text-right" : ""}`}>{column}</th>
                    ))}
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

            <div className="flex items-center justify-between border-t border-white/10 bg-black/40 p-3.5 text-xs text-white/60">
              <span>Showing {visible.length} {visible.length === 1 ? "job" : "jobs"}</span>
              <nav aria-label="Pagination" className="flex items-center gap-1.5">
                <PageButton icon="chevron_left" label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} />
                <span aria-current="page" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/20 font-mono font-bold text-white">
                  {currentPage + 1}
                </span>
                <PageButton icon="chevron_right" label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} />
              </nav>
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
      <dd className={`mt-1 font-mono text-2xl font-bold ${className}`}>{value}</dd>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <select aria-label={label} value={value} onChange={onChange}
      className="rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-medium shadow-sm">
      {options.map(([optionValue, text]) => (
        <option key={optionValue} value={optionValue}>{text}</option>
      ))}
    </select>
  );
}

function PageButton({ icon, label, disabled, onClick }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-sm transition hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30">
      <span className="icon text-[16px]" aria-hidden="true">{icon}</span>
    </button>
  );
}

function EmptyRow() {
  return (
    <tr>
      <td colSpan={8} className="py-12 text-center">
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
