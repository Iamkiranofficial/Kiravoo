const MAGIC_HOUR_API = "https://api.magichour.ai";

function errorMessage(data: any) {
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.detail === "string") return data.detail;
  return "Magic Hour could not start this render.";
}

async function uploadFile(apiKey: string, file: File, type: "image" | "audio") {
  const extension = (file.name.split(".").pop() || (type === "image" ? "png" : "mp3")).toLowerCase();
  const urls = await fetch(`${MAGIC_HOUR_API}/v1/files/upload-urls`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ extension, type }] }),
  });
  const info = await urls.json().catch(() => ({}));
  if (!urls.ok || !info?.items?.[0]) throw new Error(errorMessage(info));
  const item = info.items[0];
  const upload = await fetch(item.upload_url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!upload.ok) throw new Error("KIRAVO could not upload your media file.");
  return item.file_path as string;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    if (!apiKey) return Response.json({ error: "KIRAVO is not connected to the video engine yet." }, { status: 500 });

    const form = await request.formData();
    const mode = form.get("mode");
    const prompt = typeof form.get("prompt") === "string" ? String(form.get("prompt")).trim() : "";
    const duration = Number(form.get("duration") || 5);
    const model = form.get("model") === "wan-2.2" ? "wan-2.2" : "ltx-2";
    const image = form.get("image");
    const audio = form.get("audio");

    if (mode !== "image" && mode !== "voice") return Response.json({ error: "Choose a media generation mode." }, { status: 400 });
    if (!(image instanceof File) || image.size === 0) return Response.json({ error: "Please upload an image." }, { status: 400 });
    if (image.size > 200 * 1024 * 1024) return Response.json({ error: "Image is larger than the 200 MB free upload limit." }, { status: 400 });
    if (mode === "voice" && (!(audio instanceof File) || audio.size === 0)) return Response.json({ error: "Please upload an audio file for Voice → Video." }, { status: 400 });
    if (duration < 1 || duration > 30) return Response.json({ error: "Choose a duration between 1 and 30 seconds." }, { status: 400 });

    const imagePath = await uploadFile(apiKey, image, "image");
    let endpoint = "/v1/image-to-video";
    let body: any;

    if (mode === "image") {
      body = {
        name: `KIRAVO Image — ${new Date().toISOString()}`,
        end_seconds: duration,
        assets: { image_file_path: imagePath },
        model,
        resolution: "480p",
        audio: model === "ltx-2",
        style: { prompt: prompt || "Subtle cinematic camera motion, natural movement, polished visual storytelling" },
      };
    } else {
      const audioPath = await uploadFile(apiKey, audio as File, "audio");
      endpoint = "/v1/animation";
      body = {
        name: `KIRAVO Voice Video — ${new Date().toISOString()}`,
        end_seconds: duration,
        assets: { image_file_path: imagePath, audio_file_path: audioPath, audio_source: "file" },
        width: 576,
        height: 576,
        fps: 12,
        style: { art_style: "Cinematic", camera_effect: "Simple Zoom In", prompt: prompt || "Cinematic motion with depth and subtle environmental movement", prompt_type: "custom", transition_speed: 5 },
      };
    }

    const response = await fetch(`${MAGIC_HOUR_API}${endpoint}`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) return Response.json({ error: response.status === 402 ? "Not enough Magic Hour credits for this render." : errorMessage(data) }, { status: response.status || 502 });

    return Response.json({ id: data.id, status: "queued", mode, duration, model, creditsCharged: data.credits_charged ?? null });
  } catch (error) {
    console.error("KIRAVO media generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Media generation failed." }, { status: 500 });
  }
}
