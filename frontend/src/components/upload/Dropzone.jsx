"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBytes, formatSeconds } from "@/lib/format";

const FORMATS = ["MP4", "MOV", "AVI", "JPG", "PNG"];

/** Big drop target that turns into a preview of the chosen file. Validation happens in the page. */
export default function Dropzone({ file, accept, maxMb, disabled, onSelect }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const browse = () => input.current.click();

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!disabled && event.dataTransfer.files[0]) onSelect(event.dataTransfer.files[0]);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`halo flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-[22px] ${dragging ? "halo-active" : ""}`}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          if (event.target.files[0]) onSelect(event.target.files[0]);
          event.target.value = ""; // allow picking the same file again after removing it
        }}
      />
      {file ? (
        <Preview key={previewUrl} file={file} url={previewUrl} disabled={disabled} onReplace={browse} onRemove={() => onSelect(null)} />
      ) : (
        <EmptyState dragging={dragging} maxMb={maxMb} disabled={disabled} onBrowse={browse} />
      )}
    </div>
  );
}

function EmptyState({ dragging, maxMb, disabled, onBrowse }) {
  return (
    <div className="group flex flex-1 flex-col items-center justify-center gap-5 px-6 py-14 text-center">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-xl transition-transform duration-500 ${
          dragging ? "scale-110" : "group-hover:scale-105"
        }`}
      >
        <span className={`icon text-[40px] transition-transform duration-500 ${dragging ? "-translate-y-1" : ""}`} aria-hidden="true">
          upload
        </span>
      </div>
      <div>
        <h2 className="text-lg font-semibold">{dragging ? "Release to upload" : "Drag and drop a video or image"}</h2>
        <p className="mt-1 text-xs text-white/60">Up to {maxMb ?? "…"} MB. Your file is analysed frame by frame.</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onBrowse}
        className="rounded-full bg-scarlet px-6 py-2.5 text-xs font-bold transition hover:bg-scarlet-dark active:scale-[0.97] disabled:opacity-50"
      >
        Select file
      </button>
      <ul className="flex gap-1.5" aria-label="Supported formats">
        {FORMATS.map((format) => (
          <li key={format} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">{format}</li>
        ))}
      </ul>
    </div>
  );
}

function Preview({ file, url, disabled, onReplace, onRemove }) {
  const [duration, setDuration] = useState(null);
  const [unplayable, setUnplayable] = useState(false);
  const isImage = file.type.startsWith("image/");
  const details = isImage ? "Image" : duration ? `Video · ${formatSeconds(duration * 1000)}` : "Video";

  return (
    <div className="keep-dark relative flex-1 bg-black">
      {isImage && <img src={url} alt={`Preview of ${file.name}`} className="absolute inset-0 h-full w-full object-contain" />}
      {!isImage && !unplayable && (
        <video
          src={`${url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          aria-label={`Preview of ${file.name}`}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => setUnplayable(true)}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      {!isImage && unplayable && (
        // Some formats (e.g. AVI) can't play in browsers; the server still processes them.
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
          <span className="icon text-[40px]" aria-hidden="true">movie</span>
          <span className="text-xs">No browser preview for this format</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-10">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={file.name}>{file.name}</p>
          <p className="text-xs text-white/60">{formatBytes(file.size)} · {details}</p>
        </div>
        {!disabled && (
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onReplace} className="pill px-4 py-1.5 text-xs font-semibold">Replace</button>
            <button type="button" onClick={onRemove} aria-label="Remove file" className="icon-btn">
              <span className="icon text-[16px]" aria-hidden="true">close</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
