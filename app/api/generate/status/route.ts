const MAGIC_HOUR_API = "https://api.magichour.ai";
const HF_SPACE = "https://lightricks-ltx-video-distilled.hf.space";
const HF_LTX23_SPACE = "https://lightricks-ltx-2-3.hf.space";

function parseSseError(raw: string) {
  if (!raw || raw === "null") return "Hugging Face rejected the generation job. The Space returned an empty error.";
  try { const parsed = JSON.parse(raw); if (typeof parsed === "string" && parsed.trim()) return parsed; if (parsed && typeof parsed === "object") return parsed.message || parsed.detail || parsed.error || JSON.stringify(parsed); } catch {}
  return raw;
}

function getErrorMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const item = value as { message?: unknown; detail?: unknown };
    if (typeof item.message === "string" && item.message.trim()) return item.message;
    if (typeof item.detail === "string" && item.detail.trim()) return item.detail;
  }
  return "Video generation failed.";
}

function extractVideoUrl(value: unknown, space: string): string | null {
  if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) return value;
  if (typeof value === "string" && value.trim()) return space + "/gradio_api/file=" + encodeURIComponent(value);
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  for (const key of ["url", "video", "path"]) {
    const candidate = item[key];
    if (typeof candidate === "string" && (candidate.startsWith("http://") || candidate.startsWith("https://"))) return candidate;
    if (key === "path" && typeof candidate === "string" && candidate.trim()) return space + "/gradio_api/file=" + encodeURIComponent(candidate);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = extractVideoUrl(entry, space);
      if (url) return url;
    }
  }
  if (item.data) return extractVideoUrl(item.data, space);
  return null;
}

async function readFreeJob(encodedJob: string, space: string, expectedEndpoint: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return Response.json({ error: "HF_TOKEN is not configured.", provider: "huggingface" }, { status: 503 });

  const separator = encodedJob.indexOf(":");
  const endpoint = separator >= 0 ? decodeURIComponent(encodedJob.slice(0, separator)) : expectedEndpoint;
  const eventId = separator >= 0 ? decodeURIComponent(encodedJob.slice(separator + 1)) : decodeURIComponent(encodedJob);
  const endpointPath = String(endpoint).replace(/^\/+/, "").replace(/^v2\//, "");

  if (endpointPath !== expectedEndpoint) {
    return Response.json({ error: "Invalid Hugging Face generation endpoint.", provider: "huggingface" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    // Hugging Face documents POST /call/v2/<endpoint> for newer Gradio Spaces,
    // while polling uses GET /call/<endpoint>/<event_id>.
    const response = await fetch(`${space}/gradio_api/call/${endpointPath}/${encodeURIComponent(eventId)}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return Response.json({ error: text || `Hugging Face status returned HTTP ${response.status}.`, provider: "huggingface", httpStatus: response.status }, { status: response.status || 502 });
    }
    const text = await response.text();
    const events = text.split("\n\n").filter(Boolean);
    let lastStatus = "processing";
    for (const event of events) {
      const lines = event.split("\n");
      const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (eventName === "error") return Response.json({ status: "error", error: parseSseError(raw), provider: "huggingface" });
      if (eventName === "complete") {
        try {
          const parsed = JSON.parse(raw);
          const url = extractVideoUrl(parsed, space);
          if (!url) return Response.json({ status: "error", error: "Hugging Face completed the job but returned no video file.", provider: "huggingface" });
          return Response.json({ status: "complete", url, provider: "huggingface" });
        } catch {
          return Response.json({ status: "complete", url: null, provider: "huggingface" });
        }
      }
      if (eventName === "status") lastStatus = raw || "processing";
    }
    return Response.json({ status: lastStatus.includes("queue") ? "queued" : "processing", url: null, provider: "huggingface" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return Response.json({ status: "processing", url: null, provider: "huggingface" });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Missing video job id." }, { status: 400 });
    if (id.startsWith("hf23:")) return readFreeJob(id.slice(5), HF_LTX23_SPACE, "generate_video");
    if (id.startsWith("hf:")) return readFreeJob(id.slice(3), HF_SPACE, "text_to_video");

    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    if (!apiKey) return Response.json({ error: "KIRAVO is not connected to a video engine." }, { status: 503 });
    const response = await fetch(`${MAGIC_HOUR_API}/v1/video-projects/${encodeURIComponent(id)}`, { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return Response.json({ error: getErrorMessage(data), provider: "magichour" }, { status: response.status || 502 });
    const status = data?.status;
    const url = Array.isArray(data?.downloads) ? data.downloads[0]?.url : undefined;
    return Response.json({ id: data?.id || id, status, url: status === "complete" ? url || null : null, error: status === "error" ? getErrorMessage(data?.error) : null, provider: "magichour" });
  } catch (error) {
    console.error("KIRAVO status error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not check video status." }, { status: 500 });
  }
}
