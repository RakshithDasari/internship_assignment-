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

export default function Header() {
  const current = activeHref(usePathname());

  return (
    <header className="glass-nav mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 rounded-full pl-6 pr-3">
      <Link href="/" className="font-headline text-xl tracking-wider text-white transition hover:text-scarlet">
        VISIONQUEST
      </Link>

      <nav aria-label="Main" className="flex items-center rounded-full border border-white/10 bg-white/[0.06] p-1">
        {NAV.map(({ href, label, icon }) => {
          const isActive = current === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition sm:px-4 ${
                isActive ? "dark-segmented-active font-semibold" : "font-medium text-white/70 hover:text-white"
              }`}
            >
              <span className="icon text-[15px]" aria-hidden="true">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>

      <HealthStatus />
    </header>
  );
}

/** Quiet when everything is up ("Live"), explicit when something is down. Details on hover. */
function HealthStatus() {
  const { label, healthy, detail } = useHealth();
  return (
    <div role="status" title={detail} className="hidden items-center gap-2 px-3 text-xs md:flex">
      <span className={`h-2 w-2 rounded-full ${healthy ? "bg-success-glow shadow-[0_0_8px_#507D3A]" : "bg-white/40"}`} />
      <span className={healthy ? "text-white/70" : "font-semibold text-white"}>{label}</span>
    </div>
  );
}
