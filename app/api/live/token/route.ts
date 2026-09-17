const MODEL = process.env.KIRAVO_LIVE_MODEL || "gemini-3.8-live";

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "KIRAVO Live is not connected yet. Add GEMINI_API_KEY in Vercel." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const now = Date.now();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Gemini Live token provisioning failed:", data);
      return Response.json(
        { error: data?.error?.message || "Gemini Live authentication failed." },
        { status: response.status || 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json(
      { token: data?.name, model: MODEL },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("KIRAVO Live token error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not start KIRAVO Live." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
