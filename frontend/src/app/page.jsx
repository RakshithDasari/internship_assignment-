"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHealth } from "@/lib/hooks";
import styles from "./intro.module.css";

export default function IntroPage() {
  const router = useRouter();
  const { label, healthy } = useHealth();
  const [run, setRun] = useState(0); // changing the key remounts the stage, which restarts every animation

  useEffect(() => {
    function onKey(event) {
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName)) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        router.push("/upload");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className={styles.screen}>
      <div key={`curtain-${run}`} className={styles.curtain} onAnimationEnd={() => router.push("/upload")} />

      <header className="flex max-h-[18vh] w-full flex-1 items-center justify-between px-8 font-mono text-xs tracking-widest text-white/60">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success-glow" />
          <span className="font-bold tracking-wider text-white">VISIONQUEST</span>
          <span className="text-white/40" aria-hidden="true">|</span>
          <span>CV INFERENCE PIPELINE</span>
        </div>
        <span>YOLOv8 • YOLO-World • YOLOv8-Seg</span>
      </header>

      <main key={`stage-${run}`} className={styles.letterbox}>
        <div className={styles.backdrop} />
        <InkIllustration className={styles.ink} />
        <div className={styles.reel} />
        <div className={styles.vignette} />
        <div className={styles.glint} />
        <h1 className={`${styles.hero} font-headline`}>VisionQuest</h1>
        <div className={styles.hud}>
          <p className="flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-5 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-white shadow-xl backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-success-glow" />
            Detect. Track. Count.
          </p>
        </div>
      </main>

      <footer className="z-30 flex max-h-[18vh] w-full flex-1 items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/upload"
            className="flex items-center gap-2 rounded-full border border-white/20 bg-scarlet px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(229,57,53,0.5)] transition hover:scale-105 hover:bg-scarlet-dark"
          >
            <span className="icon text-[16px]" aria-hidden="true">cloud_upload</span>
            Upload
          </Link>
          <button
            type="button"
            onClick={() => setRun((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-mono text-xs text-white transition hover:bg-white/20"
          >
            <span className="icon text-[15px]" aria-hidden="true">replay</span>
            Replay Intro
          </button>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-white/60">
          <span className="hidden items-center gap-2 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${healthy ? "bg-success-glow" : "bg-white/40"}`} />
            {label}
          </span>
          <span className="font-semibold text-white">Press [Space] to continue</span>
        </div>
      </footer>
    </div>
  );
}

/** Decorative hatch, halftone and bounding-box line art behind the wordmark. */
function InkIllustration({ className }) {
  return (
    <svg className={className} viewBox="0 0 1400 600" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#000" strokeWidth="1.8" />
        </pattern>
        <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.8" fill="#220505" />
        </pattern>
      </defs>
      <path d="M 0,0 L 450,0 L 320,380 L 120,600 L 0,600 Z" fill="url(#hatch)" opacity="0.65" />
      <path d="M 1400,0 L 980,0 L 1100,320 L 1320,600 L 1400,600 Z" fill="url(#hatch)" opacity="0.55" />
      <circle cx="240" cy="180" r="140" fill="none" stroke="#220505" strokeWidth="14" opacity="0.4" />
      <circle cx="1180" cy="380" r="160" fill="none" stroke="#220505" strokeWidth="16" opacity="0.4" />
      <rect x="380" y="40" width="640" height="520" fill="url(#dots)" opacity="0.3" />
      <rect x="180" y="90" width="190" height="280" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6,4" opacity="0.5" />
      <rect x="750" y="110" width="380" height="420" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="8,6" opacity="0.4" />
    </svg>
  );
}
