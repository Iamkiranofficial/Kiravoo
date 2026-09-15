const MAGIC_HOUR_API = "https://api.magichour.ai";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "KIRAVO is not connected to the video engine yet." }, { status: 500 });
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json({ error: "Please describe the video you want to create." }, { status: 400 });
    }

    if (prompt.length > 20000) {
      return Response.json({ error: "Your prompt is too long." }, { status: 400 });
    }

    const response = await fetch(`${MAGIC_HOUR_API}/v1/text-to-video`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `KIRAVO — ${new Date().toISOString()}`,
        end_seconds: 5,
        aspect_ratio: "16:9",
        resolution: "480p",
        model: "wan-2.2",
        audio: false,
        style: { prompt },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.id) {
      const message = typeof data?.message === "string" ? data.message : "Magic Hour could not start the video render.";
      return Response.json({ error: message }, { status: response.status || 502 });
    }

    return Response.json({ id: data.id, status: "queued", duration: 5 });
  } catch (error) {
    console.error("KIRAVO generation error:", error);
    const message = error instanceof Error ? error.message : "Video generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
