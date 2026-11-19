"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
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
  const pathname = usePathname();
  const current = activeHref(pathname);
  const nav = useRef(null);
  const indicator = useRef(null);
  const placed = useRef(false);

  // Moves the red pill under the active link. The first placement and resizes jump; page changes slide.
  useLayoutEffect(() => {
    function place(animate) {
      const pill = indicator.current;
      const active = nav.current?.querySelector('[aria-current="page"]');
      if (!pill) return;
      pill.style.opacity = active ? "1" : "0";
      if (!active) return;
      pill.style.transition = animate ? "" : "none";
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
      placed.current = true;
    }
    place(placed.current);
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [current]);

  if (pathname === "/") return null; // the intro is full-screen

  return (
    <div className="px-3 py-3 md:px-5 md:pb-4 md:pt-5">
      {/* Title left, page links in a centred pill, status right. 1fr|auto|1fr keeps the pill truly centred. */}
      <header className="flex h-14 items-center justify-between gap-2 px-1 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-3 md:px-3">
        <div className="keep-dark flex items-baseline gap-3 justify-self-start">
          <Link href="/" className="font-headline text-xl tracking-wider text-white transition hover:text-scarlet md:text-3xl">
            VISIONQUEST
          </Link>
          <span className="hidden text-xs font-medium text-white/50 lg:inline">Detect. Track. Count.</span>
        </div>

        <nav ref={nav} aria-label="Main" className="glass-nav relative flex items-center rounded-full p-1.5">
          <span ref={indicator} className="nav-indicator" aria-hidden="true" />
          {NAV.map(({ href, label, icon }) => {
            const isActive = current === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors duration-300 sm:px-4 ${
                  isActive ? "font-semibold text-[#fff]" : "font-medium text-white/70 hover:text-white"
                }`}
              >
                <span className="icon text-[15px]" aria-hidden="true">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="keep-dark flex items-center justify-self-end">
          <HealthStatus />
          <ThemeToggle />
        </div>
      </header>
    </div>
  );
}

// The theme lives on <html data-theme>, set before paint by the script in layout.jsx.
const readTheme = () => document.documentElement.dataset.theme ?? "dark";
const onThemeChange = (callback) => {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
};

function ThemeToggle() {
  const theme = useSyncExternalStore(onThemeChange, readTheme, () => "dark");
  const next = theme === "light" ? "dark" : "light";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {} // private mode: the choice just isn't remembered
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button type="button" onClick={toggle} className="icon-btn" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <span className="icon text-[18px]" aria-hidden="true">{theme === "light" ? "dark_mode" : "light_mode"}</span>
    </button>
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
