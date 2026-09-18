const MAGIC_HOUR_API = "https://api.magichour.ai";
const HF_SPACE = "https://lightricks-ltx-video-distilled.hf.space";
const HF_LTX23_SPACE = "https://lightricks-ltx-2-3.hf.space";

const allowedModels = new Set(["ltx-2.3", "wan-2.2"]);
const allowedRatios = new Set(["16:9", "9:16", "1:1"]);
const allowedStyles = new Set(["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"]);
const ltxDurations = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const wanDurations = new Set([3, 4, 5, 6, 7, 8]);

function dimensions(aspectRatio: string) {
  if (aspectRatio === "9:16") return { height: 768, width: 432 };
  if (aspectRatio === "1:1") return { height: 512, width: 512 };
  return { height: 432, width: 768 };
}

function workerDimensions(aspectRatio: string) {
  // Keep the free T4 render practical while preserving the requested aspect ratio.
  if (aspectRatio === "9:16") return { height: 640, width: 360 };
  if (aspectRatio === "1:1") return { height: 512, width: 512 };
  return { height: 360, width: 640 };
}

function workerUrl() {
  return (process.env.KIRAVO_WORKER_URL || "").replace(/\/$/, "");
}

async function submitKaggleWorker(prompt: string, aspectRatio: string, duration: number, style: string) {
  const baseUrl = workerUrl();
  if (!baseUrl) throw new Error("KIRAVO_WORKER_URL is not configured.");

  const { height, width } = workerDimensions(aspectRatio);
  const actualDuration = Math.min(duration, 8);
  const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;

  // LTX uses a temporal grid of 8k+1 frames. Export is 24fps, so
  // durationSeconds * 24 is converted to the nearest valid frame count:
  // 1s=25, 2s=49, 3s=73, 4s=97, etc.
  const targetFrames = Math.max(1, Math.round(actualDuration * 24));
  const numFrames = Math.max(17, 8 * Math.round((targetFrames - 1) / 8) + 1);

  const response = await fetch(`${baseUrl}/generate`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: styledPrompt,
      negative_prompt: "worst quality, low quality, blurry, soft focus, motion blur, jittery, distorted, smeared details, noisy, pixelated",
      width,
      height,
      num_frames: numFrames,
      // More denoising steps materially improve detail; the Kaggle worker uses the
      // base 2B checkpoint, so do not use the 8-step distilled setting here.
      num_inference_steps: 20,
      seed: Math.floor(Math.random() * 1000000),
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok || !data.id) {
    throw new Error(data?.error || `KIRAVO GPU worker returned HTTP ${response.status}.`);
  }

  return Response.json({
    id: `kg:${data.id}`,
    provider: "kaggle",
    status: "queued",
    duration: actualDuration,
    model: "ltx-2b",
    aspectRatio,
    style,
    audio: false,
    creditsCharged: 0,
  });
}

async function submitGradio(token: string, baseUrl: string, endpoint: string, data: unknown[]) {
  const response = await fetch(`${baseUrl}/gradio_api/call/${endpoint}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  const eventId = payload?.event_id ?? payload?.eventId;
  if (!response.ok || !eventId) {
    const detail = typeof payload?.error === "string" ? payload.error : raw || `HTTP ${response.status}`;
    throw new Error(`Hugging Face could not start the job: ${detail.slice(0, 700)}`);
  }
  return String(eventId);
}

async function submitFreeVideo(prompt: string, aspectRatio: string, duration: number, style: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return Response.json({ error: "HF_TOKEN is not configured.", provider: "huggingface" }, { status: 503 });

  const { height, width } = dimensions(aspectRatio);
  const actualDuration = Math.min(duration, 8);
  const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;
  const data = [null, styledPrompt, actualDuration, true, 42, true, height, width];

  let eventId: string;
  let providerSpace = "ltx23";
  try {
    eventId = await submitGradio(token, HF_LTX23_SPACE, "generate_video", data);
  } catch {
    const legacyData = [styledPrompt, "worst quality, inconsistent motion, blurry, jittery, distorted", null, null, height, width, "text-to-video", actualDuration, 9, 42, true, 3, false];
    eventId = await submitGradio(token, HF_SPACE, "text_to_video", legacyData);
    providerSpace = "ltx";
  }

  return Response.json({
    id: `hf:${providerSpace}:${encodeURIComponent(eventId)}`,
    provider: "huggingface",
    status: "queued",
    duration: actualDuration,
    model: "ltx-2.3",
    aspectRatio,
    style,
    audio: providerSpace === "ltx23",
    creditsCharged: 0,
  });
}

async function submitMagicHour(apiKey: string, prompt: string, model: string, aspectRatio: string, duration: number, style: string, audio: boolean) {
  const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;
  const response = await fetch(`${MAGIC_HOUR_API}/v1/text-to-video`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `KIRAVO — ${new Date().toISOString()}`,
      end_seconds: duration,
      orientation: aspectRatio === "9:16" ? "portrait" : "landscape",
      aspect_ratio: aspectRatio,
      resolution: "480p",
      model,
      audio,
      style: { prompt: styledPrompt },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) return Response.json({ error: typeof data?.message === "string" ? data.message : "Magic Hour could not start the video render.", provider: "magichour" }, { status: response.status || 502 });
  return Response.json({ id: data.id, provider: "magichour", status: "queued", duration, model, aspectRatio, style, audio, creditsCharged: data.credits_charged ?? null });
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

    const supported = model === "wan-2.2" ? wanDurations : ltxDurations;
    if (!supported.has(duration)) {
      return Response.json({ error: `${model} supports ${model === "wan-2.2" ? "3–8" : "1–8"} seconds on the video engine.` }, { status: 400 });
    }

    // Free development worker has priority when connected.
    if (process.env.KIRAVO_WORKER_URL && model === "ltx-2.3") {
      return submitKaggleWorker(prompt, aspectRatio, duration, style);
    }

    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    if (apiKey) {
      const audio = model === "ltx-2.3" && body?.audio === true;
      return submitMagicHour(apiKey, prompt, model, aspectRatio, duration, style, audio);
    }

    if (process.env.HF_TOKEN && model === "ltx-2.3") {
      return submitFreeVideo(prompt, aspectRatio, duration, style);
    }

    return Response.json({ error: "No video engine is connected. Connect the free KIRAVO Kaggle worker with KIRAVO_WORKER_URL." }, { status: 503 });
  } catch (error) {
    console.error("KIRAVO generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Video generation failed." }, { status: 500 });
  }
}
