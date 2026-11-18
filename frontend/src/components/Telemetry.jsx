import Link from "next/link";
import { classCounts, topDetectionIndex } from "@/lib/frame";
import { shortId } from "@/lib/format";

const SCARLET = "#E53935";
const WHITE = "#FFFFFF";
const INK = "rgb(var(--ink))";
// White (reserved for person) follows the theme, so it stays visible on light cards.
const swatch = (color) => (!color || color.toUpperCase() === WHITE ? INK : color);
const textOn = (color) => (color === SCARLET ? WHITE : color === INK ? "rgb(var(--paper))" : "#0B0707");

/** The dashboards' right-hand sidebar for one frame's metadata. `title` is [lightWord, boldWord]. */
export default function Telemetry({ title, badge, jobId, record, colors }) {
  const detections = record?.detections ?? [];
  const top = topDetectionIndex(detections);
  const classes = classCounts(detections);
  const colorOf = (name) => swatch(colors[name]);

  return (
    <aside className="shade flex flex-col gap-5 overflow-y-auto p-5 lg:col-span-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg">
          <span className="font-light text-white/80">{title[0]}</span>
          <span className="font-bold">{title[1]}</span>
          <span className="flex items-center gap-1 rounded-full bg-success-glow/20 px-2 py-0.5 text-[11px] font-semibold text-success-glow">
            <span className="h-1.5 w-1.5 rounded-full bg-success-glow" />
            {badge}
          </span>
        </h2>
        <span className="font-mono text-[11px] text-white/50" title={jobId}>{shortId(jobId)}</span>
      </div>

      <dl className="grid grid-cols-3 gap-2.5">
        <Metric label="Objects" value={detections.length} />
        <Metric label="Inference" value={record?.inference_time_ms ?? "—"} unit="ms" />
        <Metric label="Top conf" value={top >= 0 ? detections[top].confidence.toFixed(2) : "—"} />
      </dl>

      <section className="dark-glass-card flex flex-col gap-3 rounded-2xl p-4" aria-label="Class distribution">
        <h3 className="text-xs font-semibold text-white/70">Classes in this frame</h3>
        {classes.length === 0 && <p className="text-xs text-white/60">No objects detected in this frame.</p>}
        {classes.map(({ name, count }) => (
          <div key={name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(name) }} />
                {name}
              </span>
              <span className="text-white/60">{count}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${(count / detections.length) * 100}%`, backgroundColor: colorOf(name) }} />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-1 flex-col gap-2" aria-label="Detected objects">
        <h3 className="text-xs font-semibold text-white/70">Detected objects ({detections.length})</h3>
        <ul className="flex flex-col gap-2">
          {detections.map((detection, index) => (
            <Entity key={index} number={index + 1} detection={detection} color={colorOf(detection.class_name)} isTop={index === top} />
          ))}
        </ul>
      </section>

      <details className="group text-xs">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-white/60 hover:text-white">
          <span className="icon text-[16px]" aria-hidden="true">data_object</span>
          Raw JSON for this frame
          <span className="icon text-[16px] transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/90 p-2.5 font-mono text-white/90">
          {JSON.stringify(record, null, 2)}
        </pre>
      </details>

      <Link href="/jobs" className="text-link self-start">
        View all jobs <span className="icon text-[14px]" aria-hidden="true">arrow_forward</span>
      </Link>
    </aside>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="dark-glass-card flex flex-col rounded-2xl p-3">
      <dt className="text-[11px] font-medium text-white/60">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-white/50">{unit}</span>}
      </dd>
    </div>
  );
}

/** One detection; click to reveal its bounding box. */
function Entity({ number, detection, color, isTop }) {
  const { bbox } = detection;
  return (
    <li>
      <details className={`group dark-glass-card rounded-xl px-3 py-2.5 ${isTop ? "border-white/30" : ""}`}>
        <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
          <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ backgroundColor: color, color: textOn(color) }}>
            {String(number).padStart(2, "0")}
          </span>
          <span className="font-semibold">{detection.class_name}</span>
          {isTop && <span className="rounded-full bg-success-glow/20 px-2 text-[11px] font-semibold text-success-glow">Top</span>}
          <span className="ml-auto flex items-center gap-2">
            {detection.track_id != null && <span className="font-mono text-[11px] text-white/50">#{detection.track_id}</span>}
            <span className="font-semibold">{detection.confidence.toFixed(2)}</span>
            <span className="icon text-[16px] text-white/50 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
          </span>
        </summary>
        <dl className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-black/50 p-2 font-mono text-[11px] text-white/80">
          {["x1", "y1", "x2", "y2"].map((key) => (
            <div key={key}>
              <dt className="text-white/50">{key}</dt>
              <dd>{bbox[key]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}
