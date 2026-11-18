"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import InkIllustration from "@/components/InkIllustration";
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
    <div className={`keep-dark ${styles.screen}`} onAnimationEnd={onScreenAnimationEnd}>
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
