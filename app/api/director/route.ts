import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

function fallbackPlan(input: any) {
  const base = String(input.prompt || "").trim();
  const style = String(input.style || "Cinematic");
  const assistant = String(input.assistantName || "KIRAVO");
  const camera = style === "Cinematic" ? "slow dolly/crane movement with layered depth" : style === "Realistic" ? "natural stabilized camera movement" : style === "Anime" ? "dynamic anime framing and expressive motion" : style === "Commercial" ? "precise premium product-film movement" : "dreamlike floating camera movement";
  const scenes = [
    "Opening — establish the location, subject and mood with a strong visual hook.",
    "Build — reveal the main action with motivated camera movement and environmental detail.",
    "Hero moment — emphasize the key subject or emotional beat with a memorable composition.",
    "Resolution — finish with a clean cinematic closing shot and visual continuity."
  ];
  const prompt = [base, "AI Director: " + assistant + " leads the creative direction.", "Style: " + style + ".", "Camera: " + camera + ".", "Prioritize coherent motion, consistent subjects, realistic depth, lighting continuity and temporal stability.", "Create a polished " + style.toLowerCase() + " video with a clear visual progression."].join(" ");
  return { prompt: prompt.slice(0, 6000), scenes, plan: "KIRAVO mapped the idea into a four-beat visual progression and added camera, continuity and cinematic direction." };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "Tell KIRAVO what you want to create." }, { status: 400 });
    if (prompt.length > 12000) return NextResponse.json({ error: "The idea is too long." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json(fallbackPlan(body));
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: [
        "You are KIRAVO’s AI Creative Director.",
        "Transform the user’s rough idea into a production-ready video concept.",
        "Do not merely rewrite the sentence. Infer useful visual details without changing the user’s core intent.",
        "Think through subject, environment, action, camera, lighting, composition, continuity, pacing and a clear beginning/middle/end.",
        "Return ONLY valid JSON with keys: prompt, plan, worldBible, scenes, scenePrompts, continuity.",
        "prompt must be a single detailed generation prompt.",
        "plan must be one concise sentence explaining the creative direction.",
        "scenes must be an array of 4 concise scene descriptions. scenePrompts must be an array of 4 detailed, standalone video-generation prompts, one per scene, each preserving the same characters, wardrobe, environment and visual style. worldBible must be a concise object with character, environment, visualStyle and continuityAnchors. continuity must be a concise list of rules that every scene must follow.",
        "Avoid claims that require external research. Do not invent named real people.",
        "User idea: " + prompt,
        "Assistant: " + String(body?.assistantName || "KIRAVO") + " (" + String(body?.assistantTag || "Creative Director") + ")",
        "Style: " + String(body?.style || "Cinematic"),
        "Aspect ratio: " + String(body?.aspectRatio || "16:9"),
        "Duration: " + String(body?.duration || 2) + " seconds",
        "Language: " + String(body?.language || "Auto-detect")
      ].join("\n") }] }]
    });
    const text = response.text || "";
    const cleaned = text.replace(/^\s*```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const data = JSON.parse(cleaned);
    if (!data.prompt || !Array.isArray(data.scenes)) throw new Error("Director returned an incomplete plan.");
    return NextResponse.json({ prompt: String(data.prompt).slice(0, 6000), plan: String(data.plan || "KIRAVO built a visual plan from your idea."), worldBible: data.worldBible && typeof data.worldBible === "object" ? data.worldBible : {}, scenes: data.scenes.slice(0, 6).map((x: unknown) => String(x).slice(0, 500)), scenePrompts: Array.isArray(data.scenePrompts) ? data.scenePrompts.slice(0, 6).map((x: unknown) => String(x).slice(0, 5000)) : [], continuity: Array.isArray(data.continuity) ? data.continuity.slice(0, 10).map((x: unknown) => String(x).slice(0, 500)) : [] });
  } catch (error) {
    console.error("KIRAVO director error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI Director failed." }, { status: 500 });
  }
}
