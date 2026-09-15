const MAGIC_HOUR_API = "https://api.magichour.ai";

export async function GET(request: Request) {
  try {
    const apiKey = process.env.MAGIC_HOUR_API_KEY;
    const id = new URL(request.url).searchParams.get("id");

    if (!apiKey) {
      return Response.json({ error: "KIRAVO is not connected to the video engine yet." }, { status: 500 });
    }

    if (!id) {
      return Response.json({ error: "Missing video job id." }, { status: 400 });
    }

    const response = await fetch(`${MAGIC_HOUR_API}/v1/video-projects/${encodeURIComponent(id)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message : "Could not check the video render.";
      return Response.json({ error: message }, { status: response.status || 502 });
    }

    const status = data?.status;
    const url = Array.isArray(data?.downloads) ? data.downloads[0]?.url : undefined;

    return Response.json({
      id: data?.id || id,
      status,
      url: status === "complete" ? url || null : null,
      error: status === "error" ? data?.error || "Magic Hour could not render the video." : null,
    });
  } catch (error) {
    console.error("KIRAVO status error:", error);
    const message = error instanceof Error ? error.message : "Could not check video status.";
    return Response.json({ error: message }, { status: 500 });
  }
}
