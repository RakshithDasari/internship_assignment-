"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppShell from "@/components/AppShell";
import { listJobs } from "@/lib/api";

/** The nav's "Dashboard" link: opens the most recent completed job, or the Jobs list if there is none. */
export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    listJobs()
      .then((jobs) => {
        const latest = jobs.find((job) => job.status === "completed");
        router.replace(latest ? `/jobs/${latest.job_id}` : "/jobs");
      })
      .catch(() => router.replace("/jobs"));
  }, [router]);

  return (
    <AppShell>
      <main className="flex flex-1 items-center justify-center text-sm text-white/60">Opening latest dashboard…</main>
    </AppShell>
  );
}
