import FileBar from "@/components/FileBar";
import Telemetry from "@/components/Telemetry";
import { resultUrl } from "@/lib/api";

/** Still-image result: no playback controls, frame counter or keyframes. */
export default function ImageDashboard({ job, metadata }) {
  const record = metadata.frames[0];
  const resolution = `${metadata.width}x${metadata.height}`;

  return (
    <main className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12 lg:overflow-hidden">
      <section className="flex flex-col gap-4 border-b border-white/10 bg-black/25 p-5 backdrop-blur-md lg:col-span-8 lg:border-b-0 lg:border-r">
        <FileBar job={job} outputLabel="image" summary={`(${metadata.width} x ${metadata.height} • Still image)`} />

        <div className="dark-glass-card relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[20px] border border-white/15 shadow-2xl">
          <img src={resultUrl(job.job_id)} alt={`Annotated result for ${job.filename}`} className="h-full w-full bg-black object-contain" />
          <div className="absolute left-4 top-4 flex items-center gap-2.5 rounded-full border border-white/25 bg-black/80 px-3 py-1.5 font-mono text-xs shadow-xl backdrop-blur-2xl">
            <span className="h-2 w-2 rounded-full bg-success-glow shadow-[0_0_8px_#507D3A]" />
            <span className="font-bold">Inference Ready</span>
            <span className="text-white/40" aria-hidden="true">|</span>
            <span className="text-white/80">{record.inference_time_ms}ms</span>
          </div>
        </div>

        <div className="dark-glass-card flex flex-wrap items-center gap-3 rounded-[20px] p-4 text-xs">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="icon text-[18px] text-white/80" aria-hidden="true">image</span>
            Single Image Evaluation
          </span>
          <span className="text-white/30" aria-hidden="true">|</span>
          <span className="font-mono text-white/60">Input Resolution: {resolution}</span>
          <span className="text-white/30" aria-hidden="true">|</span>
          <span className="font-mono text-white/60">Confidence Threshold: {job.conf.toFixed(2)}</span>
        </div>
      </section>

      <Telemetry
        title="Detection Telemetry"
        badge="Complete"
        subtitle="Still frame detection"
        jobId={job.job_id}
        record={record}
        colors={metadata.class_colors}
        distributionLabel={job.model}
        entitiesLabel={job.prompt ? "Zero-shot prompt" : ""}
      />
    </main>
  );
}
