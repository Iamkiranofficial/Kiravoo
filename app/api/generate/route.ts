const MAGIC_HOUR_API = "https://api.magichour.ai";
const HF_SPACE = "https://lightricks-ltx-video-distilled.hf.space";

const allowedModels = new Set(["ltx-2.3", "wan-2.2"]);
const allowedRatios = new Set(["16:9", "9:16", "1:1"]);
const allowedStyles = new Set(["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"]);
const ltxDurations = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const wanDurations = new Set([3, 4, 5, 6, 7, 8]);

function dimensions(aspectRatio: string) {
  if (aspectRatio === "9:16") return { height: 768, width: 432 };
  if (aspectRatio === "1:1") return { height: 640, width: 640 };
  return { height: 512, width: 704 };
}

async function submitFreeVideo(prompt: string, aspectRatio: string, duration: number, style: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return Response.json({ error: "Free video engine is ready, but KIRAVO needs a free Hugging Face token. Add HF_TOKEN in Vercel Environment Variables.", provider: "huggingface" }, { status: 503 });

  const { height, width } = dimensions(aspectRatio);
  const actualDuration = Math.min(duration, 8);
  const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;
  const payload = [
    styledPrompt,
    "worst quality, blurry, jittery, distorted, watermark",
    null,
    null,
    height,
    width,
    "text-to-video",
    actualDuration,
    Math.max(9, Math.min(257, Math.round(actualDuration * 30 / 8) * 8 + 1)),
    42,
    true,
    3,
    false,
  ];

  const response = await fetch(`${HF_SPACE}/gradio_api/call/text_to_video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.event_id) {
    const message = typeof data?.detail === "string" ? data.detail : "The free Hugging Face video queue could not be started.";
    return Response.json({ error: message, provider: "huggingface" }, { status: response.status || 502 });
  }

  return Response.json({ id: `hf:${data.event_id}`, provider: "huggingface", status: "queued", duration: actualDuration, model: "ltx-video-distilled", aspectRatio, style, audio: false, creditsCharged: 0 });
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
    if (!apiKey) return Response.json({ error: "No video engine is connected. Add a free HF_TOKEN to enable KIRAVO's free video engine." }, { status: 503 });

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
