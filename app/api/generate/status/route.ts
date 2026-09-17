const MAGIC_HOUR_API = "https://api.magichour.ai";
const HF_SPACE = "https://lightricks-ltx-2-3.hf.space";

function getErrorMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const item = value as { message?: unknown; detail?: unknown };
    if (typeof item.message === "string" && item.message.trim()) return item.message;
    if (typeof item.detail === "string" && item.detail.trim()) return item.detail;
  }
  return "Video generation failed.";
}

function extractVideoUrl(value: unknown): string | null {
  if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) return value;
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  for (const key of ["url", "video", "path"]) {
    const candidate = item[key];
    if (typeof candidate === "string" && (candidate.startsWith("http://") || candidate.startsWith("https://"))) return candidate;
  }
  if (item.data) return extractVideoUrl(item.data);
  return null;
}

async function readFreeJob(eventId: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return Response.json({ error: "HF_TOKEN is not configured.", provider: "huggingface" }, { status: 503 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${HF_SPACE}/gradio_api/call/generate_video/${encodeURIComponent(eventId)}`, {
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
      if (eventName === "error") return Response.json({ status: "error", error: raw || "Free video generation failed.", provider: "huggingface" });
      if (eventName === "complete") {
        try {
          const parsed = JSON.parse(raw);
          const url = extractVideoUrl(parsed);
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
    if (id.startsWith("hf:")) return readFreeJob(id.slice(3));

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
