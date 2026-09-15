import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, start = 0, end, captions = false, text = "KIRAVO" } = body || {};
    if (!url) return NextResponse.json({ error: "A video URL is required." }, { status: 400 });

    // Keep this endpoint provider-neutral for now. It returns a normalized edit
    // manifest that the final media worker can consume without changing the UI.
    return NextResponse.json({
      ok: true,
      status: "ready",
      source: url,
      edit: {
        trim: { start: Math.max(0, Number(start) || 0), end: end == null ? null : Math.max(0, Number(end)) },
        captions: Boolean(captions),
        captionText: String(text || "KIRAVO").slice(0, 120),
      },
      message: "Edit prepared. Final encoded export requires a media worker."
    });
  } catch {
    return NextResponse.json({ error: "Invalid edit request." }, { status: 400 });
  }
}
