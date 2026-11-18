import { classCounts, topDetectionIndex } from "@/lib/frame";
import { shortId } from "@/lib/format";

const SCARLET = "#E53935";
const textOn = (color) => (color === SCARLET ? "#FFFFFF" : "#0B0707");

/** The dashboards' right-hand sidebar for one frame's metadata. */
export default function Telemetry({ title, badge, subtitle, jobId, record, colors, distributionLabel, entitiesLabel }) {
  const detections = record?.detections ?? [];
  const top = topDetectionIndex(detections);
  const classes = classCounts(detections);
  const colorOf = (name) => colors[name] ?? "#FFFFFF";

  return (
    <aside className="flex flex-col gap-4 overflow-y-auto bg-black/40 p-5 backdrop-blur-2xl lg:col-span-4">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">{title}</h2>
            <span className="flex items-center gap-1 rounded-full border border-success-glow/40 bg-success-glow/25 px-2.5 py-0.5 font-mono text-xs font-bold text-success-glow">
              <span className="h-1.5 w-1.5 rounded-full bg-success-glow" />
              {badge}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-white/60">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-xs font-semibold">
          Job: {shortId(jobId)}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2.5">
        <Metric label="Objects" value={detections.length} />
        <Metric label="Inference time" value={record?.inference_time_ms ?? "—"} unit="ms" />
        <Metric label="Top Conf" value={top >= 0 ? detections[top].confidence.toFixed(2) : "—"} />
      </dl>

      <section className="dark-glass-card flex flex-col gap-2.5 rounded-2xl p-4" aria-label="Class distribution">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-bold">Class Distribution</h3>
          <span className="font-mono text-white/60">{distributionLabel}</span>
        </div>
        {classes.length === 0 && <p className="text-xs text-white/60">No objects detected in this frame.</p>}
        {classes.map(({ name, count }) => (
          <div key={name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(name) }} />
                {name}
              </span>
              <span className="font-mono text-white/70">{count} {count === 1 ? "instance" : "instances"}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${(count / detections.length) * 100}%`, backgroundColor: colorOf(name) }} />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-1 flex-col gap-2.5" aria-label="Detected entities">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-bold">Detected Entities ({detections.length})</h3>
          <span className="font-mono text-white/60">{entitiesLabel}</span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {detections.map((detection, index) => (
            <Entity key={index} number={index + 1} detection={detection} color={colorOf(detection.class_name)} isTop={index === top} />
          ))}
        </ul>
      </section>

      <details className="group rounded-2xl border border-white/10 bg-white/[0.04] p-3 font-mono text-xs backdrop-blur-md">
        <summary className="flex cursor-pointer select-none items-center justify-between font-bold group-open:text-scarlet">
          <span className="flex items-center gap-1.5">
            <span className="icon text-[16px]" aria-hidden="true">data_object</span>
            Raw JSON Telemetry
          </span>
          <span className="icon text-[16px] transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/90 p-2.5 text-white/90">
          {JSON.stringify(record, null, 2)}
        </pre>
      </details>
    </aside>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="dark-glass-card flex flex-col rounded-2xl p-3">
      <dt className="text-xs font-semibold text-white/60">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-bold">
        {value}
        {unit && <span className="text-xs font-normal text-white/60">{unit}</span>}
      </dd>
    </div>
  );
}

function Entity({ number, detection, color, isTop }) {
  const { bbox } = detection;
  return (
    <li className={`dark-glass-card rounded-2xl border p-3 ${isTop ? "border-white/30" : "border-white/15"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 font-mono text-xs font-bold" style={{ backgroundColor: color, color: textOn(color) }}>
            #{String(number).padStart(2, "0")}
          </span>
          <span className="text-sm font-bold">{detection.class_name}</span>
          {isTop && (
            <span className="rounded-full border border-success-glow/40 bg-success-glow/25 px-2 py-0.5 font-mono text-xs font-bold text-success-glow">
              Top conf
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono">
          {detection.track_id != null && <span className="text-xs text-white/60">#TRK-{detection.track_id}</span>}
          <span className="text-sm font-bold">{detection.confidence.toFixed(2)}</span>
        </div>
      </div>
      <details className="group mt-2 font-mono text-xs text-white/70">
        <summary className="flex cursor-pointer select-none items-center justify-between py-1 text-white/60 hover:text-white">
          Bounding box coordinates
          <span className="icon text-[15px] transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
        </summary>
        <dl className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/60 p-2 text-[11px] text-white/90">
          <Coordinate label="Class ID" value={detection.class_id} />
          <Coordinate label="Mask" value={detection.mask_present ? "Yes" : "None (BBox)"} />
          <Coordinate label="x1" value={`${bbox.x1} px`} />
          <Coordinate label="y1" value={`${bbox.y1} px`} />
          <Coordinate label="x2" value={`${bbox.x2} px`} />
          <Coordinate label="y2" value={`${bbox.y2} px`} />
        </dl>
      </details>
    </li>
  );
}

function Coordinate({ label, value }) {
  return (
    <div className="flex gap-1">
      <dt>{label}:</dt>
      <dd className="font-bold text-white">{value}</dd>
    </div>
  );
}
