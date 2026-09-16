import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export const runtime = "nodejs";
export const maxDuration = 60;

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg is unavailable in this deployment."));
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-1800) || `FFmpeg exited with ${code}`)));
  });
}

export async function POST(req: NextRequest) {
  let dir = "";
  try {
    const body = await req.json();
    const sourceUrl = typeof body?.url === "string" ? body.url : "";
    const start = Math.max(0, Number(body?.start) || 0);
    const end = Math.max(0, Number(body?.end) || 0);
    const speed = Math.min(2, Math.max(0.5, Number(body?.speed) || 1));
    const mute = Boolean(body?.mute);

    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      return Response.json({ error: "A valid video URL is required." }, { status: 400 });
    }
    if (end > 0 && end <= start) {
      return Response.json({ error: "OUT must be after IN." }, { status: 400 });
    }

    const upstream = await fetch(sourceUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) throw new Error(`Could not fetch the source video (${upstream.status}).`);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length) throw new Error("The source video is empty.");

    dir = await fs.mkdtemp(path.join(os.tmpdir(), "kiravo-edit-"));
    const input = path.join(dir, "input.mp4");
    const output = path.join(dir, "output.mp4");
    await fs.writeFile(input, bytes);

    const args = ["-y"];
    if (start > 0) args.push("-ss", String(start));
    args.push("-i", input);
    if (end > 0) args.push("-t", String(end - start));
    if (speed !== 1) args.push("-filter_complex", `[0:v]setpts=${(1 / speed).toFixed(6)}*PTS[v]`, "-map", "[v]");
    else args.push("-map", "0:v:0");
    if (!mute) args.push("-map", "0:a?", "-c:a", "aac", "-b:a", "128k");
    else args.push("-an");
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", output);

    await runFfmpeg(args);
    const result = await fs.readFile(output);
    return new Response(result, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="kiravo-export.mp4"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Export failed." }, { status: 500 });
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
