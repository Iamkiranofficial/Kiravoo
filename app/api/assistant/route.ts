const MODEL = process.env.KIRAVO_ASSISTANT_MODEL || "gemini-3.6-flash";

const personalities: Record<string,string> = {
  aria: "You are ARIA, KIRAVO's visionary creative partner. Be bold, cinematic, imaginative and decisive.",
  nova: "You are NOVA, KIRAVO's energetic creative partner. Be playful, experimental, fast and inventive.",
  luna: "You are LUNA, KIRAVO's warm storyteller. Focus on emotion, narrative, atmosphere and human feeling.",
  orion: "You are ORION, KIRAVO's precise production partner. Be structured, practical, technical and production-minded.",
  atlas: "You are ATLAS, KIRAVO's explorer. Be curious, research-minded, strategic and excellent at world-building.",
  kael: "You are KAEL, KIRAVO's refinement and editing partner. Focus on pacing, polish, clarity and final-quality execution."
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "KIRAVO's Gemini engine is not connected yet. Add GEMINI_API_KEY in Vercel." }, { status: 503 });
    }

    const body = await request.json();
    const assistant = typeof body?.assistant === "string" ? body.assistant.toLowerCase() : "aria";
    const language = typeof body?.language === "string" ? body.language : "Auto-detect";
    const messages = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
    const system = `${personalities[assistant] || personalities.aria}\nYou have access to every KIRAVO capability: video, image, voice, writing, design, editing, research and technical help. Never claim that your capabilities are limited by your personality. The user chooses personality only.\nLanguage: ${language}. Understand multilingual and mixed-language input. Reply naturally in the user's language unless they explicitly request another language. Preserve names, measurements and creative intent. If language is Auto-detect, infer it from the latest user message. Keep responses concise and actionable when helping create something.`;

    const contents = messages.map((message: any) => ({
      role: message?.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message?.content || "") }],
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 1200 },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Response.json({ error: data?.error?.message || "KIRAVO could not reach its Gemini assistant." }, { status: response.status || 502 });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("").trim();
    return Response.json({ text: text || "I’m ready. What should we create?", assistant, language, model: MODEL });
  } catch (error) {
    console.error("KIRAVO assistant error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Assistant request failed." }, { status: 500 });
  }
}
