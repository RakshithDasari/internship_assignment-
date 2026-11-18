"use client";

import { useRef, useState } from "react";
import { formatBytes } from "@/lib/format";

/** Drag-and-drop area plus file picker. Reports the chosen file; validation happens in the page. */
export default function Dropzone({ file, accept, maxMb, disabled, onSelect }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!disabled && event.dataTransfer.files[0]) onSelect(event.dataTransfer.files[0]);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-black/40 p-6 text-center shadow-sm backdrop-blur-lg transition ${
        dragging ? "border-scarlet" : "border-white/20 hover:border-scarlet"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => event.target.files[0] && onSelect(event.target.files[0])}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-md">
        <span className="icon text-[28px] text-scarlet" aria-hidden="true">arrow_upward</span>
      </div>
      <h2 className="mt-3 text-sm font-bold">Drag &amp; drop video or image here</h2>
      <p className="mt-1 text-xs text-white/60">
        Supports MP4, AVI, MOV, JPG, PNG (maximum upload size: {maxMb ?? "…"}MB)
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current.click()}
        className="mt-3 rounded-full border border-white/20 bg-scarlet px-5 py-2 text-xs font-bold shadow-[0_0_15px_rgba(229,57,53,0.35)] transition hover:bg-scarlet-dark disabled:opacity-50"
      >
        Browse Files
      </button>

      {file && (
        <div className="mt-3 flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs shadow-sm">
          <span className="icon text-[18px] text-success-glow" aria-hidden="true">
            {file.type.startsWith("image/") ? "image" : "movie"}
          </span>
          <span className="max-w-[16rem] truncate font-mono font-bold" title={file.name}>{file.name}</span>
          <span className="font-mono text-white/60">({formatBytes(file.size)})</span>
          {!disabled && (
            <button type="button" onClick={() => onSelect(null)} aria-label="Remove file" className="ml-2 text-white/60 hover:text-scarlet">
              <span className="icon text-[16px]" aria-hidden="true">close</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
