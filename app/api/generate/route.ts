import { Client } from "@gradio/client";

const MAGIC_HOUR_API = "https://api.magichour.ai";
const HF_SPACE = "https://lightricks-ltx-2-3.hf.space";
const HF_SPACE_ID = "Lightricks/LTX-2-3";

const allowedModels = new Set(["ltx-2.3", "wan-2.2"]);
const allowedRatios = new Set(["16:9", "9:16", "1:1"]);
const allowedStyles = new Set(["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"]);
const ltxDurations = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const wanDurations = new Set([3, 4, 5, 6, 7, 8]);

function dimensions(aspectRatio: string) {
  if (aspectRatio === "9:16") return { height: 1536, width: 864 };
  if (aspectRatio === "1:1") return { height: 1024, width: 1024 };
  return { height: 1024, width: 1536 };
}

async function submitFreeVideo(prompt: string, aspectRatio: string, duration: number, style: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return Response.json({ error: "HF_TOKEN is not configured.", provider: "huggingface" }, { status: 503 });

  const { height, width } = dimensions(aspectRatio);
  const actualDuration = Math.min(duration, 8);
  const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;

  // Use Hugging Face's official Gradio JS client. It discovers the live API
  // endpoint instead of hard-coding a route that can change with Gradio.
  const app = await Client.connect(HF_SPACE_ID, { token, events: ["status", "data"] });
  const api = await app.view_api();
  let endpoint: string | number = "/generate_video";

  if (!api.named_endpoints?.[endpoint]) {
    const unnamed = Object.keys(api.unnamed_endpoints || {});
    if (!unnamed.length) throw new Error("LTX-2.3 did not expose a callable generation endpoint.");
    endpoint = Number(unnamed[0]);
  }

  const job = app.submit(endpoint, [null, styledPrompt, actualDuration, false, 42, true, height, width]);
  const eventId = await (job as any).event_id();
  if (!eventId) throw new Error("Hugging Face did not return a generation event ID.");

  return Response.json({
    id: `hf:${encodeURIComponent(String(endpoint))}:${eventId}`,
    provider: "huggingface",
    status: "queued",
    duration: actualDuration,
    model: "ltx-2.3",
    aspectRatio,
    style,
    audio: true,
    creditsCharged: 0,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const model = typeof body?.model === "string" && allowedModels.has(body.model) ? body.model : "ltx-2.3";
    const aspectRatio = typeof body?.aspectRatio === "string" && allowedRatios.has(body.aspectRatio) ? body.aspectRatio : "16:9";
    const style = typeof body?.style === "string" && allowedStyles.has(body.style) ? body.style : "Cinematic";
    const requestedDuration = Number(body?.duration);
    const duration = Number.isInteger(requestedDuration) ? requestedDuration : 2;

    if (!prompt) return Response.json({ error: "Please describe the video you want to create." }, { status: 400 });
    if (prompt.length > 20000) return Response.json({ error: "Your prompt is too long." }, { status: 400 });

    const supportedDurations = model === "wan-2.2" ? wanDurations : ltxDurations;
    if (!supportedDurations.has(duration)) return Response.json({ error: `${model} supports ${model === "wan-2.2" ? "3–8" : "1–8"} seconds on the free engine.` }, { status: 400 });

    if (process.env.HF_TOKEN) return submitFreeVideo(prompt, aspectRatio, duration, style);

    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    if (!apiKey) return Response.json({ error: "No video engine is connected. Add HF_TOKEN to enable KIRAVO's free video engine." }, { status: 503 });

    const audio = model === "ltx-2.3" && body?.audio === true;
    const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;
    const response = await fetch(`${MAGIC_HOUR_API}/v1/text-to-video`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `KIRAVO — ${new Date().toISOString()}`, end_seconds: duration, orientation: aspectRatio === "9:16" ? "portrait" : "landscape", aspect_ratio: aspectRatio, resolution: "480p", model, audio, style: { prompt: styledPrompt } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) return Response.json({ error: typeof data?.message === "string" ? data.message : "Magic Hour could not start the video render." }, { status: response.status || 502 });
    return Response.json({ id: data.id, provider: "magichour", status: "queued", duration, model, aspectRatio, style, audio, creditsCharged: data.credits_charged ?? null });
  } catch (error) {
    console.error("KIRAVO generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Video generation failed." }, { status: 500 });
  }
}
