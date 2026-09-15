const MODEL = process.env.KIRAVO_ASSISTANT_MODEL || "gpt-5.6-luna";

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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "KIRAVO's AI conversation engine is not connected yet. Add OPENAI_API_KEY in Vercel." }, { status: 503 });
    const body = await request.json();
    const assistant = typeof body?.assistant === "string" ? body.assistant.toLowerCase() : "aria";
    const language = typeof body?.language === "string" ? body.language : "Auto-detect";
    const messages = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
    const system = `${personalities[assistant] || personalities.aria}\nYou have access to every KIRAVO capability: video, image, voice, writing, design, editing, research and technical help. Never claim that your capabilities are limited by your personality. The user chooses personality only.\nLanguage: ${language}. Understand multilingual and mixed-language input. Reply naturally in the user's language unless they explicitly request another language. Preserve names, measurements and creative intent. If language is Auto-detect, infer it from the latest user message. Keep responses concise and actionable when helping create something.`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, instructions: system, input: messages, max_output_tokens: 1200 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return Response.json({ error: data?.error?.message || "KIRAVO could not reach its AI assistant." }, { status: response.status || 502 });
    return Response.json({ text: data.output_text || "I’m ready. What should we create?", assistant, language, model: MODEL });
  } catch (error) {
    console.error("KIRAVO assistant error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Assistant request failed." }, { status: 500 });
  }
}
