"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import ErrorBanner from "@/components/ErrorBanner";
import Dropzone from "@/components/upload/Dropzone";
import InferenceSettings from "@/components/upload/InferenceSettings";
import JobProgress from "@/components/upload/JobProgress";
import ModelPicker from "@/components/upload/ModelPicker";
import { cancelJob, getModels, uploadMedia } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { FINISHED, useHealth, useJob } from "@/lib/hooks";

const PROMPT_REQUIRED = "Please enter at least one prompt for YOLO-World detection.";

export default function UploadPage() {
  // useSearchParams (for ?job=…) must sit inside a Suspense boundary in Next 16.
  return (
    <Suspense>
      <UploadScreen />
    </Suspense>
  );
}

function UploadScreen() {
  const router = useRouter();
  const jobId = useSearchParams().get("job");
  const { health } = useHealth();
  const { job, frame } = useJob(jobId);

  const [models, setModels] = useState(null);
  const [file, setFile] = useState(null);
  const [model, setModel] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [confidence, setConfidence] = useState(null);
  const [device, setDevice] = useState("auto");
  const [upload, setUpload] = useState(null);
  const [error, setError] = useState(null);
  const [promptError, setPromptError] = useState(null);
  const abortUpload = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch((err) => setError({ title: "Couldn't load models.", detail: err.message }));
  }, []);

  const selectedModel = model ?? models?.default_model;
  const spec = models?.models.find((m) => m.id === selectedModel);
  const threshold = confidence ?? models?.default_confidence ?? 0.45;
  const jobRunning = Boolean(job) && !FINISHED.has(job.status);
  const busy = Boolean(upload) || jobRunning;
  const allowed = health?.allowed_extensions;

  function chooseFile(next) {
    setError(null);
    if (!next) return setFile(null);
    const extension = next.name.split(".").pop().toLowerCase();
    if (allowed && !allowed.includes(extension)) {
      setFile(null);
      return setError({ title: "Unsupported file format.", detail: `Please upload ${allowed.join(", ").toUpperCase()} files.` });
    }
    const maxMb = health?.max_file_size_mb;
    if (maxMb && next.size > maxMb * 1024 * 1024) {
      setFile(null);
      return setError({ title: `File exceeds ${maxMb}MB limit.`, detail: `Selected file is ${formatBytes(next.size)}. Please select a smaller file.` });
    }
    return setFile(next);
  }

  async function submit(event) {
    event?.preventDefault();
    if (!file || busy || !spec) return;
    if (spec.needs_prompt && !prompt.trim()) return setPromptError(PROMPT_REQUIRED);
    setPromptError(null);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("model", spec.id);
    form.append("conf", String(threshold));
    form.append("device", device);
    if (spec.needs_prompt) form.append("prompt", prompt);

    const startedAt = performance.now();
    const { promise, abort } = uploadMedia(form, (loaded, total) => {
      const seconds = (performance.now() - startedAt) / 1000;
      setUpload({ loaded, total, bytesPerSecond: seconds > 0 ? loaded / seconds : 0 });
    });
    abortUpload.current = abort;
    setUpload({ loaded: 0, total: file.size, bytesPerSecond: 0 });
    try {
      const { job_id } = await promise;
      router.replace(`/upload?job=${job_id}`, { scroll: false }); // a refresh resumes this job
    } catch (err) {
      if (err.code !== "ABORTED") setError({ title: err.message, retry: err.code === "NETWORK" });
    } finally {
      setUpload(null);
      abortUpload.current = null;
    }
  }

  async function cancel() {
    if (upload) return abortUpload.current?.();
    if (job?.status === "queued") {
      await cancelJob(job.job_id).catch((err) => setError({ title: err.message }));
    }
    setFile(null);
    setError(null);
    router.replace("/upload", { scroll: false });
  }

  // "Press [Enter] to submit" when focus isn't inside a form control.
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Enter" && document.activeElement === document.body) submitRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AppShell>
      <main className="flex flex-1 items-center p-4 sm:p-6 lg:p-8">
        <form onSubmit={submit} className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div>
            <h1 className="text-3xl">
              <span className="font-light text-white/80">Upload</span> <span className="font-bold">Media</span>
            </h1>
            <p className="mt-1 text-sm text-white/60">Drop a file, pick a model, and watch it get analysed live.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-7">
              <Dropzone
                file={file}
                accept={allowed?.map((ext) => `.${ext}`).join(",")}
                maxMb={health?.max_file_size_mb}
                disabled={busy}
                onSelect={chooseFile}
              />
              {error && (
                <ErrorBanner
                  title={error.title}
                  detail={error.detail}
                  onRetry={error.retry ? submit : undefined}
                  onDismiss={error.retry ? undefined : () => setError(null)}
                />
              )}
              {(upload || job) && <JobProgress upload={upload} job={job} frame={frame} />}
            </div>

            <div className="flex flex-col gap-5 rounded-[22px] border border-white/10 bg-black/40 p-5 backdrop-blur-2xl lg:col-span-5">
              {models ? (
                <ModelPicker
                  models={models.models}
                  defaultModel={models.default_model}
                  selected={selectedModel}
                  onSelect={(id) => {
                    setModel(id);
                    setPromptError(null);
                  }}
                  prompt={prompt}
                  onPrompt={setPrompt}
                  promptError={promptError}
                  disabled={busy}
                />
              ) : (
                <p className="text-xs text-white/60">Loading models…</p>
              )}

              <InferenceSettings
                confidence={threshold}
                onConfidence={setConfidence}
                device={device}
                onDevice={setDevice}
                gpu={{ available: Boolean(models?.devices.gpu), name: models?.devices.gpu_name }}
                disabled={busy}
              />

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
                <button
                  type="submit"
                  disabled={!file || busy || !spec}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-scarlet py-3 text-sm font-bold transition hover:bg-scarlet-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="icon text-[18px]" aria-hidden="true">rocket_launch</span>
                  Run inference
                </button>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>or press Enter</span>
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={job?.status === "processing"}
                    title={job?.status === "processing" ? "Running jobs can't be cancelled" : undefined}
                    className="font-medium hover:text-white disabled:opacity-40"
                  >
                    {busy ? "Cancel" : "Reset"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
