import { NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

function allowedRemoteUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host.startsWith("172.16.") ||
      host.startsWith("172.17.") ||
      host.startsWith("172.18.") ||
      host.startsWith("172.19.") ||
      host.startsWith("172.2") ||
      host.startsWith("172.30.") ||
      host.startsWith("172.31.")
    ) return false;
    return true;
  } catch {
    return false;
  }
}

async function download(url: string, file: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download scene video (HTTP ${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 120 * 1024 * 1024) {
    throw new Error("A scene video is too large to assemble on this server.");
  }

  const fileHandle = await fs.open(file, "w");
  try {
    const reader = response.body.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 120 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("A scene video is too large to assemble on this server.");
      }
      await fileHandle.write(value);
    }
  } finally {
    await fileHandle.close();
  }
}

export async function POST(request: Request) {
  const jobDir = path.join(os.tmpdir(), `kiravo-film-${randomUUID()}`);

  try {
    const body = await request.json().catch(() => ({}));
    const urls = Array.isArray(body?.urls) ? body.urls : [];

    if (urls.length < 2 || urls.length > 8) {
      return NextResponse.json({ error: "Provide between 2 and 8 generated scene videos." }, { status: 400 });
    }
    if (!urls.every(allowedRemoteUrl)) {
      return NextResponse.json({ error: "One or more scene URLs are not valid secure video URLs." }, { status: 400 });
    }
    if (!ffmpegPath) {
      return NextResponse.json({ error: "The video assembly engine is unavailable in this deployment." }, { status: 503 });
    }

    await fs.mkdir(jobDir, { recursive: true });

    const sceneFiles: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const file = path.join(jobDir, `scene-${String(i + 1).padStart(2, "0")}.mp4`);
      await download(urls[i], file);
      sceneFiles.push(file);
    }

    const listFile = path.join(jobDir, "concat.txt");
    const list = sceneFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(listFile, list, "utf8");

    const outputFile = path.join(jobDir, "kiravo-final-film.mp4");
    await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-f", "concat",
      "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      "-movflags", "+faststart",
      "-y",
      outputFile
    ], { timeout: 240000 });

    const output = await fs.readFile(outputFile);
    return new NextResponse(output, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(output.byteLength),
        "Content-Disposition": 'inline; filename="kiravo-final-film.mp4"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("KIRAVO film assembly error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not assemble the final film." },
      { status: 500 }
    );
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}
