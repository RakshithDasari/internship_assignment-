"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHealth } from "@/lib/hooks";

const NAV = [
  { href: "/upload", label: "Upload", icon: "cloud_upload" },
  { href: "/dashboard", label: "Dashboard", icon: "play_circle" },
  { href: "/jobs", label: "Jobs", icon: "list_alt" },
];

function activeHref(pathname) {
  if (pathname.startsWith("/jobs/")) return "/dashboard"; // a job's dashboard
  return pathname;
}

export default function Header({ chip }) {
  const current = activeHref(usePathname());

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 backdrop-blur-2xl sm:px-6">
      <div className="flex items-baseline gap-2.5">
        <Link href="/" className="font-headline text-xl tracking-wider text-white transition hover:text-scarlet">
          VISIONQUEST
        </Link>
        <span className="hidden font-mono text-xs font-medium tracking-wider text-white/60 lg:inline">
          Detect. Track. Count.
        </span>
      </div>

      <nav aria-label="Main" className="flex items-center rounded-full border border-white/10 bg-white/[0.06] p-1 shadow-inner backdrop-blur-md">
        {NAV.map(({ href, label, icon }) => {
          const isActive = current === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition sm:px-4 ${
                isActive ? "dark-segmented-active font-bold" : "font-semibold text-white/70 hover:text-white"
              }`}
            >
              <span className="icon text-[15px]" aria-hidden="true">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>

      {chip ?? <HealthChip />}
    </header>
  );
}

/** The status pill on the right of the header. `children` adds screen-specific detail after a divider. */
export function HealthChip({ children }) {
  const { label, healthy } = useHealth();
  return (
    <div
      role="status"
      className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 font-mono text-xs text-white shadow-sm md:flex"
    >
      <span className={`h-2 w-2 rounded-full ${healthy ? "bg-success-glow shadow-[0_0_8px_#507D3A]" : "bg-white/40"}`} />
      <span className="font-bold">{label}</span>
      {children && (
        <>
          <span className="text-white/30" aria-hidden="true">|</span>
          <span className="text-white/60">{children}</span>
        </>
      )}
    </div>
  );
}
