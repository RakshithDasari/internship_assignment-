"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FileBar from "@/components/FileBar";
import Telemetry from "@/components/Telemetry";
import { resultUrl, thumbnailUrl } from "@/lib/api";
import { frameAt, seekTime } from "@/lib/frame";
import { formatClock, formatSeconds } from "@/lib/format";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export default function VideoDashboard({ job, metadata }) {
  const video = useRef(null);
  const stage = useRef(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false); // the big play button only shows before the first play
  const [speed, setSpeed] = useState(1);

  const { fps, frames, keyframes } = metadata;
  const lastFrame = frames.length - 1;
  const record = frames[Math.min(frameIndex, lastFrame)];

  const syncTo = useCallback((seconds) => setFrameIndex(frameAt(seconds, fps, frames.length)), [fps, frames.length]);

  // timeupdate (~4 times a second) is the baseline sync; where the browser supports it,
  // requestVideoFrameCallback reports the exact media time of every painted frame.
  useEffect(() => {
    const element = video.current;
    if (!element?.requestVideoFrameCallback) return undefined;
    let handle;
    const onFrame = (_now, info) => {
      syncTo(info.mediaTime);
      handle = element.requestVideoFrameCallback(onFrame);
    };
    handle = element.requestVideoFrameCallback(onFrame);
    return () => element.cancelVideoFrameCallback(handle);
  }, [syncTo]);

  const seekToFrame = useCallback(
    (index) => {
      const target = Math.min(Math.max(index, 0), lastFrame);
      video.current.currentTime = seekTime(target, fps);
      setFrameIndex(target);
    },
    [fps, lastFrame],
  );

  const step = useCallback(
    (delta) => {
      video.current.pause();
      seekToFrame(frameAt(video.current.currentTime, fps, frames.length) + delta);
    },
    [fps, frames.length, seekToFrame],
  );

  const togglePlay = useCallback(() => {
    const element = video.current;
    if (element.paused) element.play();
    else element.pause();
  }, []);

  function changeSpeed(value) {
    setSpeed(value);
    video.current.playbackRate = value;
  }

  // Space = play/pause, arrows = one frame, unless focus is on a control that uses those keys.
  useEffect(() => {
    function onKey(event) {
      if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(document.activeElement?.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        step(event.code === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, togglePlay]);

  return (
    <main className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12 lg:overflow-hidden">
      <section className="flex flex-col gap-4 shade-soft border-b border-white/10 p-5 lg:col-span-8 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <FileBar
          job={job}
          outputLabel="video"
          summary={`${frames.length} frames · ${fps.toFixed(1)} fps · ${formatSeconds(metadata.duration_ms)}`}
        />

        <div ref={stage} className="keep-dark group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl">
          <video
            ref={video}
            src={resultUrl(job.job_id)}
            preload="auto"
            playsInline
            aria-label={`Annotated video of ${job.filename}`}
            onClick={togglePlay}
            onPlay={() => {
              setPlaying(true);
              setStarted(true);
            }}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => syncTo(event.currentTarget.currentTime)}
            onSeeked={(event) => syncTo(event.currentTarget.currentTime)}
            className="h-full w-full object-contain"
          />
          {!started && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play"
              className="absolute flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/50 backdrop-blur-xl transition hover:bg-scarlet/80 group-hover:scale-105"
            >
              <span className="icon ml-0.5 text-[30px]" aria-hidden="true">play_arrow</span>
            </button>
          )}
        </div>

        <div className="dark-glass-card flex flex-col gap-3 rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap font-mono text-xs font-bold text-scarlet">{formatClock(record.timestamp_ms)}</span>
            <input
              type="range"
              min={0}
              max={lastFrame}
              value={Math.min(frameIndex, lastFrame)}
              onChange={(event) => seekToFrame(Number(event.target.value))}
              aria-label="Seek"
              aria-valuetext={`Frame ${frameIndex} of ${lastFrame}`}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-scarlet"
            />
            <span className="whitespace-nowrap font-mono text-xs text-white/60">{formatClock(metadata.duration_ms)}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconButton icon="skip_previous" label="Previous frame (Left arrow)" onClick={() => step(-1)} />
              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-scarlet px-4 py-1.5 text-xs font-bold transition hover:bg-scarlet-dark active:scale-[0.97]"
              >
                <span className="icon text-[18px]" aria-hidden="true">{playing ? "pause" : "play_arrow"}</span>
                {playing ? "Pause [Space]" : "Play [Space]"}
              </button>
              <IconButton icon="skip_next" label="Next frame (Right arrow)" onClick={() => step(1)} />
              <span className="mx-1 h-4 w-px bg-white/20" aria-hidden="true" />
              <span className="text-xs text-white/60">
                Frame <span className="font-semibold text-white">{record.frame_index}</span> / {lastFrame}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-white/60">
                Speed:
                <select
                  value={speed}
                  onChange={(event) => changeSpeed(Number(event.target.value))}
                  className="rounded-lg border border-white/15 bg-black/60 px-2 py-0.5 text-xs text-white shadow-sm"
                >
                  {SPEEDS.map((value) => (
                    <option key={value} value={value}>{value.toFixed(value < 1 ? 2 : 1)}x</option>
                  ))}
                </select>
              </label>
              <IconButton icon="fullscreen" label="Full screen" onClick={() => stage.current.requestFullscreen?.()} />
            </div>
          </div>
        </div>

        <Keyframes jobId={job.job_id} keyframes={keyframes} current={record.frame_index} onSelect={seekToFrame} />
      </section>

      <Telemetry
        title={["Live", "Telemetry"]}
        badge="Synced"
        jobId={job.job_id}
        record={record}
        colors={metadata.class_colors}
      />
    </main>
  );
}

function IconButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="icon-btn">
      <span className="icon text-[18px]" aria-hidden="true">{icon}</span>
    </button>
  );
}

function Keyframes({ jobId, keyframes, current, onSelect }) {
  return (
    <section className="dark-glass-card rounded-[20px] p-3.5" aria-label="Keyframes">
      <h3 className="mb-2.5 flex items-center gap-2 px-1 text-xs font-bold">
        <span className="icon text-[18px] text-white/70" aria-hidden="true">collections</span>
        Keyframes
        <span className="font-normal text-white/60">· most objects first</span>
      </h3>
      {keyframes.length === 0 ? (
        <p className="px-1 text-xs text-white/60">No frames with detections.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {keyframes.map((keyframe, index) => {
            const active = keyframe.frame_index === current;
            return (
              <li key={keyframe.frame_index}>
                <button
                  type="button"
                  onClick={() => onSelect(keyframe.frame_index)}
                  aria-label={`Seek to frame ${keyframe.frame_index}, ${keyframe.total_objects} objects`}
                  className={`lift w-full rounded-xl p-1.5 text-left shadow-sm backdrop-blur-md ${
                    active ? "border-2 border-white/40 bg-white/10" : "border border-white/15 bg-white/5 hover:border-white/40"
                  }`}
                >
                  <span className="relative block aspect-video overflow-hidden rounded-lg border border-white/15">
                    <img src={thumbnailUrl(jobId, keyframe.frame_index)} alt="" className="h-full w-full object-cover" />
                    {(index === 0 || active) && (
                      <span className={`absolute right-1 top-1 rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-success-glow" : "bg-black/60"}`}>
                        {active ? "Active" : "Peak"}
                      </span>
                    )}
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 text-[10px] font-bold">
                      {keyframe.total_objects} objects
                    </span>
                  </span>
                  <span className="mt-1.5 flex items-center justify-between px-0.5 text-xs">
                    <span className="font-bold">Frame {keyframe.frame_index}</span>
                    <span className="text-white/60">{formatSeconds(keyframe.timestamp_ms)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
