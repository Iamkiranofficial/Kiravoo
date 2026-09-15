const MAGIC_HOUR_API = "https://api.magichour.ai";

const allowedModels = new Set(["ltx-2.3", "wan-2.2"]);
const allowedRatios = new Set(["16:9", "9:16", "1:1"]);
const allowedStyles = new Set(["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"]);
const ltxDurations = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30]);
const wanDurations = new Set([3, 4, 5, 6, 7, 8, 9, 10, 15]);

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "KIRAVO is not connected to the video engine yet." }, { status: 500 });
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const model = typeof body?.model === "string" && allowedModels.has(body.model) ? body.model : "ltx-2.3";
    const aspectRatio = typeof body?.aspectRatio === "string" && allowedRatios.has(body.aspectRatio) ? body.aspectRatio : "16:9";
    const style = typeof body?.style === "string" && allowedStyles.has(body.style) ? body.style : "Cinematic";
    const requestedDuration = Number(body?.duration);
    const duration = Number.isInteger(requestedDuration) ? requestedDuration : 1;
    const audio = model === "ltx-2.3" && body?.audio === true;
    const supportedDurations = model === "wan-2.2" ? wanDurations : ltxDurations;

    if (!prompt) {
      return Response.json({ error: "Please describe the video you want to create." }, { status: 400 });
    }

    if (prompt.length > 20000) {
      return Response.json({ error: "Your prompt is too long." }, { status: 400 });
    }

    if (!supportedDurations.has(duration)) {
      const minimum = model === "wan-2.2" ? 3 : 1;
      return Response.json({ error: `${model} supports ${model === "wan-2.2" ? "3–15" : "1–30"} seconds. Choose ${minimum} seconds or another supported duration.` }, { status: 400 });
    }

    const styledPrompt = style === "Cinematic" ? prompt : `${style} visual style. ${prompt}`;

    const response = await fetch(`${MAGIC_HOUR_API}/v1/text-to-video`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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

    if (!response.ok || !data.id) {
      if (response.status === 402) {
        const detail = typeof data?.message === "string" ? data.message : "You do not have enough Magic Hour credits for these settings.";
        return Response.json({ error: `${detail} Try LTX 2.3 at 1 second, which starts at about 24 credits, or add more credits.` }, { status: 402 });
      }
      const message = typeof data?.message === "string" ? data.message : "Magic Hour could not start the video render.";
      return Response.json({ error: message }, { status: response.status || 502 });
    }

    return Response.json({ id: data.id, status: "queued", duration, model, aspectRatio, style, audio, creditsCharged: data.credits_charged ?? null });
  } catch (error) {
    console.error("KIRAVO generation error:", error);
    const message = error instanceof Error ? error.message : "Video generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
