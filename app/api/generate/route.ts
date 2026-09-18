const MAGIC_HOUR_API = "https://api.magichour.ai";
const HF_SPACE = "https://lightricks-ltx-video-distilled.hf.space";
const HF_LTX23_SPACE = "https://lightricks-ltx-2-3.hf.space";

const allowedModels = new Set(["ltx-2.3", "wan-2.2"]);
const allowedRatios = new Set(["16:9", "9:16", "1:1"]);
const allowedStyles = new Set(["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"]);
const ltxDurations = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const wanDurations = new Set([3, 4, 5, 6, 7, 8]);

function dimensions(aspectRatio: string) {
  // Keep the free ZeroGPU render small enough for reliable inference.
  // The Space supports up to 1280px, but its own UI uses much smaller defaults.
  if (aspectRatio === "9:16") return { height: 768, width: 432 };
  if (aspectRatio === "1:1") return { height: 512, width: 512 };
  return { height: 432, width: 768 };
}

async function submitGradio(token: string, baseUrl: string, endpoint: string, data: unknown[]) {
  // The Lightricks Space is running Gradio 5.42 and its source defines
  // text_to_video as a positional input list. Use the native Gradio call API.
  const attempts = [
    { url: `${baseUrl}/gradio_api/call/${endpoint}`, body: { data } },
    { url: `${baseUrl}/gradio_api/call/v2/${endpoint}`, body: Object.fromEntries([
      ["t2v_prompt", data[0]],
      ["negative_prompt_input", data[1]],
      ["image_n_hidden", data[2]],
      ["video_n_hidden", data[3]],
      ["height_input", data[4]],
      ["width_input", data[5]],
      ["mode", data[6]],
      ["duration_input", data[7]],
      ["frames_to_use", data[8]],
      ["seed_input", data[9]],
      ["randomize_seed_input", data[10]],
      ["guidance_scale_input", data[11]],
      ["improve_texture", data[12]]
    ]) }
  ];

  let lastMessage = "";
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(attempt.body),
      cache: "no-store",
    });
    const text = await response.text();
    let payload: any = {};
    try { payload = text ? JSON.parse(text) : {}; } catch {}

    const eventId = payload?.event_id ?? payload?.eventId;
    if (response.ok && eventId) return { eventId: String(eventId), endpoint };

    lastMessage = typeof payload?.error === "string"
      ? payload.error
      : text || `HTTP ${response.status}`;
  }

  throw new Error(`Hugging Face could not start the job: ${lastMessage.slice(0, 700)}`);
}

async function submitFreeVideo(prompt: string, aspectRatio: string, duration: number, style: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return Response.json({ error: "HF_TOKEN is not configured.", provider: "huggingface" }, { status: 503 });

  const { height, width } = dimensions(aspectRatio);
  const actualDuration = Math.min(duration, 8);
  const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;
  // Use Lightricks' current LTX-2.3 distilled Space.
  const data = [null, styledPrompt, actualDuration, true, 42, true, height, width];

  let result: { eventId: string; endpoint: string };
  let jobPrefix = "hf23";
  try {
    result = await submitGradio(token, HF_LTX23_SPACE, "generate_video", data);
  } catch {
    // Keep the older LTX Video Fast Space as a compatibility fallback.
    const legacyData = [styledPrompt, "worst quality, inconsistent motion, blurry, jittery, distorted", null, null, height, width, "text-to-video", actualDuration, 9, 42, true, 3, false];
    result = await submitGradio(token, HF_SPACE, "text_to_video", legacyData);
    jobPrefix = "hf";
  }

  return Response.json({
    id: `${jobPrefix}:${encodeURIComponent(result.endpoint)}:${encodeURIComponent(result.eventId)}`,
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

    if (process.env.HF_TOKEN && model === "ltx-2.3") return submitFreeVideo(prompt, aspectRatio, duration, style);

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
    const status = Number((error as any)?.status);
    return Response.json({ error: error instanceof Error ? error.message : "Video generation failed." }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
