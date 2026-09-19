import { NextResponse } from "next/server";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function fallbackPlan(input: Record<string, unknown>) {
  const base = String(input.prompt || "").trim();
  const style = String(input.style || "Cinematic");
  const assistant = String(input.assistantName || "KIRAVO");
  const camera =
    style === "Cinematic"
      ? "slow dolly or crane movement with layered depth"
      : style === "Realistic"
        ? "natural stabilized camera movement"
        : style === "Anime"
          ? "dynamic anime framing and expressive motion"
          : style === "Commercial"
            ? "precise premium product-film movement"
            : "dreamlike floating camera movement";
  const scenes = [
    "Opening — establish the location, subject and mood with a strong visual hook.",
    "Build — reveal the main action with motivated camera movement and environmental detail.",
    "Hero moment — emphasize the key subject or emotional beat with a memorable composition.",
    "Resolution — finish with a clean cinematic closing shot and visual continuity."
  ];
  const prompt = [
    base,
    "AI Director: " + assistant + " leads the creative direction.",
    "Style: " + style + ".",
    "Camera: " + camera + ".",
    "Prioritize coherent motion, consistent subjects, realistic depth, lighting continuity and temporal stability.",
    "Create a polished " + style.toLowerCase() + " video with a clear visual progression."
  ].join(" ");
  return {
    prompt: prompt.slice(0, 6000),
    plan: "KIRAVO mapped the idea into a four-beat visual progression and added camera, continuity and cinematic direction.",
    scenes,
    worldBible: {},
    scenePrompts: scenes.map((scene) => base + ". " + scene + " Maintain consistent characters, wardrobe, environment and visual style."),
    continuity: ["Keep subjects consistent.", "Keep wardrobe and environment consistent.", "Preserve lighting and camera language."]
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Tell KIRAVO what you want to create." }, { status: 400 });
    }
    if (prompt.length > 12000) {
      return NextResponse.json({ error: "The idea is too long." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json(fallbackPlan(body));

    const instructions = [
      "You are KIRAVO’s AI Creative Director.",
      "Transform the user’s rough idea into a production-ready video concept.",
      "Infer useful visual details without changing the user's core intent.",
      "Think through subject, environment, action, camera, lighting, composition, continuity, pacing and a clear beginning, middle and end.",
      "Return ONLY valid JSON with keys: prompt, plan, worldBible, scenes, scenePrompts, continuity.",
      "prompt is one detailed generation prompt.",
      "plan is one concise sentence.",
      "scenes is an array of 4 concise scene descriptions.",
      "scenePrompts is an array of 4 detailed standalone video-generation prompts. Every scene must preserve the same characters, wardrobe, environment and visual style.",
      "worldBible is an object with character, environment, visualStyle and continuityAnchors.",
      "continuity is a concise list of rules every scene must follow.",
      "Do not invent named real people or claims requiring external research.",
      "User idea: " + prompt,
      "Assistant: " + String(body.assistantName || "KIRAVO") + " (" + String(body.assistantTag || "Creative Director") + ")",
      "Style: " + String(body.style || "Cinematic"),
      "Aspect ratio: " + String(body.aspectRatio || "16:9"),
      "Duration: " + String(body.duration || 2) + " seconds",
      "Language: " + String(body.language || "Auto-detect")
    ].join("\n");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instructions }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
        cache: "no-store"
      }
    );

    const responseData = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      throw new Error(
        responseData.error?.message || "Gemini could not create the director plan."
      );
    }

    const parts = responseData.candidates?.[0]?.content?.parts || [];
    const text = parts.map((part) => part.text || "").join("").trim();
    if (!text) throw new Error("Gemini returned an empty director response.");

    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data.prompt || !Array.isArray(data.scenes)) {
      throw new Error("Director returned an incomplete plan.");
    }

    return NextResponse.json({
      prompt: String(data.prompt).slice(0, 6000),
      plan: String(data.plan || "KIRAVO built a visual plan from your idea."),
      worldBible: data.worldBible && typeof data.worldBible === "object" ? data.worldBible : {},
      scenes: data.scenes.slice(0, 6).map((item) => String(item).slice(0, 500)),
      scenePrompts: Array.isArray(data.scenePrompts)
        ? data.scenePrompts.slice(0, 6).map((item) => String(item).slice(0, 5000))
        : [],
      continuity: Array.isArray(data.continuity)
        ? data.continuity.slice(0, 10).map((item) => String(item).slice(0, 500))
        : []
    });
  } catch (error) {
    console.error("KIRAVO director error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI Director failed." },
      { status: 500 }
    );
  }
}
