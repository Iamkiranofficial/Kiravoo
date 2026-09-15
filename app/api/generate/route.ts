import { experimental_generateVideo as generateVideo } from "ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json({ error: "Please describe the video you want to create." }, { status: 400 });
    }

    if (prompt.length > 20000) {
      return Response.json({ error: "Your prompt is too long." }, { status: 400 });
    }

    const result = await generateVideo({
      model: "alibaba/wan-v3.0-video",
      prompt,
      duration: 5,
      aspectRatio: "16:9",
    });

    const video = result.videos?.[0] as unknown as {
      url?: string;
      base64?: string;
      mediaType?: string;
    } | undefined;

    if (!video) {
      throw new Error("The video model returned no video.");
    }

    if (video.url) {
      return Response.json({ url: video.url, duration: 5 });
    }

    if (video.base64) {
      return Response.json({
        url: `data:${video.mediaType || "video/mp4"};base64,${video.base64}`,
        duration: 5,
      });
    }

    throw new Error("The generated video did not include a playable URL.");
  } catch (error) {
    console.error("KIRAVO generation error:", error);
    const message = error instanceof Error ? error.message : "Video generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
