"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHealth } from "@/lib/hooks";
import styles from "./intro.module.css";

export default function IntroPage() {
  const router = useRouter();
  const { label, healthy } = useHealth();

  // Space or Enter skips the intro.
  useEffect(() => {
    function onKey(event) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        router.push("/upload");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // The screen's own fade-out ends the intro; child animations also bubble here, so check the target.
  function onScreenAnimationEnd(event) {
    if (event.target === event.currentTarget) router.push("/upload");
  }

  return (
    <div className={styles.screen} onAnimationEnd={onScreenAnimationEnd}>
      <header className={`${styles.bar} flex max-h-[18vh] w-full flex-1 items-center justify-between px-8 font-mono text-xs tracking-widest text-white/60`}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success-glow" />
          <span className="font-bold tracking-wider text-white">VISIONQUEST</span>
          <span className="text-white/40" aria-hidden="true">|</span>
          <span>CV INFERENCE PIPELINE</span>
        </div>
        <span>YOLOv8 • YOLO-World • YOLOv8-Seg</span>
      </header>

      <main className={styles.letterbox}>
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

      <footer className={`${styles.bar} flex max-h-[18vh] w-full flex-1 items-center justify-end gap-4 px-8 font-mono text-xs text-white/60`}>
        <span className="hidden items-center gap-2 sm:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${healthy ? "bg-success-glow" : "bg-white/40"}`} />
          {label}
        </span>
        <span className="font-semibold text-white">Press [Space] to continue</span>
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
