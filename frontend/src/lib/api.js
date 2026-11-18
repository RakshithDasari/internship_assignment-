const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not set (see .env.example).");
}

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(API_BASE + path, options);
  } catch {
    throw new ApiError("Can't reach the server.", "NETWORK", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `Request failed (${response.status}).`, body.code ?? "HTTP_ERROR", response.status);
  }
  return response.status === 204 ? null : response.json();
}

export const getHealth = () => request("/health");
export const getModels = () => request("/models");
export const listJobs = () => request("/jobs").then((body) => body.jobs);
export const getJob = (jobId) => request(`/jobs/${jobId}`);
export const getMetadata = (jobId) => request(`/jobs/${jobId}/metadata`);
export const cancelJob = (jobId) => request(`/jobs/${jobId}/cancel`, { method: "POST" });
export const deleteJob = (jobId) => request(`/jobs/${jobId}`, { method: "DELETE" });

export const resultUrl = (jobId, download = false) =>
  `${API_BASE}/jobs/${jobId}/result${download ? "?download=1" : ""}`;
export const metadataUrl = (jobId, download = false) =>
  `${API_BASE}/jobs/${jobId}/metadata${download ? "?download=1" : ""}`;
export const thumbnailUrl = (jobId, frame) => `${API_BASE}/jobs/${jobId}/thumbs/${frame}`;
export const liveUrl = (jobId) => `${API_BASE.replace(/^http/, "ws")}/ws/jobs/${jobId}`;

/**
 * Uploads with progress. Uses XMLHttpRequest because fetch() has no upload-progress events.
 * Returns { promise, abort }; the promise resolves to { job_id, status }.
 */
export function uploadMedia(formData, onProgress) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open("POST", `${API_BASE}/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page; fall back to a generic message below
      }
      if (xhr.status === 202) resolve(body);
      else reject(new ApiError(body.detail ?? "Upload failed.", body.code ?? "HTTP_ERROR", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Upload failed: can't reach the server.", "NETWORK", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled.", "ABORTED", 0));
    xhr.send(formData);
  });
  return { promise, abort: () => xhr.abort() };
}
