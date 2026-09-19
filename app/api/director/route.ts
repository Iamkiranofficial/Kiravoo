import { NextResponse } from "next/server";

type DirectorBody = {
  prompt?: string;
  assistantName?: string;
  assistantTag?: string;
  style?: string;
  aspectRatio?: string;
  duration?: number;
  language?: string;
};

function fallback(body: DirectorBody) {
  const idea = String(body.prompt || "").trim();
  return NextResponse.json({
    prompt: idea,
    plan: "KIRAVO will shape the idea into a cinematic four-beat sequence.",
    scenes: [
      "Opening: establish the world, subject and mood.",
      "Build: introduce the main action and camera movement.",
      "Hero moment: emphasize the key visual beat.",
      "Resolution: close with a memorable cinematic composition."
    ],
    scenePrompts: [],
    worldBible: {},
    continuity: []
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DirectorBody;
    const idea = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!idea) {
      return NextResponse.json({ error: "Tell KIRAVO what you want to create." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fallback(body);

    const instruction = [
      "You are KIRAVO AI Director.",
      "Turn the user's rough video idea into a stronger production-ready concept.",
      "Preserve the user's core idea while intelligently adding camera, lighting, environment, action and continuity.",
      "Return ONLY valid JSON.",
      "Keys: prompt, plan, scenes, scenePrompts, worldBible, continuity.",
      "scenes must contain exactly 4 short scene descriptions.",
      "scenePrompts must contain exactly 4 standalone video prompts.",
      "Keep the same characters, wardrobe, environment and visual style across all scene prompts.",
      "worldBible must describe character, environment, visualStyle and continuityAnchors.",
      "continuity must be an array of continuity rules.",
      "User idea: " + idea,
      "Style: " + String(body.style || "Cinematic"),
      "Aspect ratio: " + String(body.aspectRatio || "16:9"),
      "Duration: " + String(body.duration || 5) + " seconds"
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
          contents: [{ role: "user", parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
        cache: "no-store"
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || "Gemini Director request failed." },
        { status: 502 }
      );
    }

    const text = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text || "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Gemini returned an empty Director response." }, { status: 502 });
    }

    const data = JSON.parse(text);

    return NextResponse.json({
      prompt: String(data.prompt || idea).slice(0, 6000),
      plan: String(data.plan || "").slice(0, 1000),
      scenes: Array.isArray(data.scenes) ? data.scenes.slice(0, 4).map(String) : [],
      scenePrompts: Array.isArray(data.scenePrompts) ? data.scenePrompts.slice(0, 4).map(String) : [],
      worldBible: data.worldBible && typeof data.worldBible === "object" ? data.worldBible : {},
      continuity: Array.isArray(data.continuity) ? data.continuity.slice(0, 10).map(String) : []
    });
  } catch (error) {
    console.error("KIRAVO Director error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI Director failed." },
      { status: 500 }
    );
  }
}
