/**
 * Architecture Review Agent API client
 */

const BASE = "";

export async function reviewArchitecture(content, forceInfer = false) {
  const res = await fetch(`${BASE}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, force_infer: forceInfer }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Review failed");
  }
  return res.json();
}

export async function reviewFile(file, forceInfer = false) {
  const form = new FormData();
  form.append("file", file);
  const url = `${BASE}/api/review/upload?force_infer=${forceInfer}`;
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload review failed");
  }
  return res.json();
}

export function pngDownloadUrl(runId) {
  return `${BASE}/api/download/png/${runId}`;
}

export function excalidrawDownloadUrl(runId) {
  return `${BASE}/api/download/excalidraw/${runId}`;
}

export async function fetchPngBlobUrl(runId) {
  const res = await fetch(pngDownloadUrl(runId));
  if (!res.ok) throw new Error("Failed to fetch PNG");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
