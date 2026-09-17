const MODEL = process.env.KIRAVO_LIVE_MODEL || "gemini-3.8-live";

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "KIRAVO Live is not connected yet. Add GEMINI_API_KEY in Vercel." },
        { status: 503 }
      );
    }

    const now = Date.now();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: `models/${MODEL}`,
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Response.json(
        { error: data?.error?.message || "Gemini Live authentication failed." },
        { status: response.status || 502 }
      );
    }

    return Response.json({ token: data?.name, model: MODEL });
  } catch (error) {
    console.error("KIRAVO Live token error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not start KIRAVO Live." },
      { status: 500 }
    );
  }
}
