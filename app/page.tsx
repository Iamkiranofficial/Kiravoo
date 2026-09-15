"use client";

import { useEffect, useRef, useState } from "react";

const examples = [
  "A cinematic drone shot flying over Hyderabad at sunset",
  "A tiny robot discovering a glowing forest at midnight",
  "Luxury car commercial on a rain-soaked neon street",
];

type Status = "idle" | "generating" | "done" | "error";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [renderStage, setRenderStage] = useState("Starting your render…");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  async function waitForVideo(id: string) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 5 * 60 * 1000) {
      const response = await fetch(`/api/generate/status?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not check the render status.");
      }

      if (data.status === "complete" && data.url) {
        setVideoUrl(data.url);
        setStatus("done");
        return;
      }

      if (data.status === "error" || data.status === "canceled") {
        throw new Error(data.error || "Magic Hour could not render the video.");
      }

      setRenderStage(data.status === "queued" ? "Your render is queued…" : "Rendering your world…");
      await new Promise<void>((resolve) => {
        pollTimer.current = setTimeout(resolve, 3000);
      });
    }

    throw new Error("The render is taking longer than expected. Please try again.");
  }

  async function generate() {
    const value = prompt.trim();
    if (!value || status === "generating") return;

    setStatus("generating");
    setError("");
    setVideoUrl("");
    setRenderStage("Starting your render…");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      const data = await response.json();

      if (!response.ok || !data.id) {
        throw new Error(data.error || "KIRAVO could not start the video.");
      }

      await waitForVideo(data.id);
    } catch (err) {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span className="brand-mark">K</span><span>KIRAVO</span></div>
        <div className="nav-links"><a href="#studio">Studio</a><a href="#works">Explore</a><a href="#about">About</a></div>
        <button className="ghost">Sign in</button>
      </nav>

      <section className="hero" id="studio">
        <div className="eyebrow"><span className="pulse" /> AI CREATIVE STUDIO</div>
        <h1>Turn an idea into<br /><em>a world.</em></h1>
        <p className="sub">KIRAVO turns a simple thought into cinematic direction, scenes, motion and visual stories.</p>

        <div className="composer">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the video you imagine..." rows={3} disabled={status === "generating"} />
          <div className="composer-bottom">
            <div className="chips"><button type="button">16:9</button><button type="button">5s</button><button type="button">🎬 Cinematic</button></div>
            <button className="generate" onClick={generate} disabled={!prompt.trim() || status === "generating"}>
              {status === "generating" ? "Creating…" : "Generate"} <span>{status === "generating" ? "◌" : "↗"}</span>
            </button>
          </div>
        </div>

        <div className="suggestions">
          <span>Try an idea</span>
          {examples.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}
        </div>

        {status === "generating" && (
          <div className="result-card"><div className="result-orb" /><div><strong>{renderStage}</strong><p>KIRAVO is sending your direction to the video engine. This can take a little while.</p></div><span className="ready">RENDERING</span></div>
        )}

        {status === "error" && (
          <div className="result-card error-card"><div className="result-orb" /><div><strong>Generation failed.</strong><p>{error}</p></div><button className="retry" onClick={generate}>Retry</button></div>
        )}

        {status === "done" && videoUrl && (
          <div className="video-result">
            <div className="video-head"><div><span className="eyebrow">YOUR KIRAVO WORLD</span><h2>Rendered in <em>motion.</em></h2></div><span className="ready">5 SEC · 16:9</span></div>
            <video src={videoUrl} controls autoPlay playsInline className="generated-video" />
            <div className="video-actions"><a className="download" href={videoUrl} target="_blank" rel="noreferrer">Open video ↗</a><button className="retry" onClick={generate}>Create another</button></div>
          </div>
        )}
      </section>

      <section className="works" id="works">
        <div className="section-head"><div><span className="eyebrow">THE KIRAVO METHOD</span><h2>From thought to <em>motion.</em></h2></div><span className="index">01 — 03</span></div>
        <div className="cards">
          <article><span className="number">01</span><div className="icon">✦</div><h3>Imagine</h3><p>Start with words. KIRAVO understands mood, camera language, setting and story.</p></article>
          <article><span className="number">02</span><div className="icon">◈</div><h3>Direct</h3><p>Shape your idea into scenes, shots and a coherent visual direction you can actually make.</p></article>
          <article><span className="number">03</span><div className="icon">↗</div><h3>Create</h3><p>Render with a real video model. Keep the concept yours from first frame to final cut.</p></article>
        </div>
      </section>

      <footer id="about"><div className="brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><span>Make something nobody has seen before.</span><span>© 2026 KIRAVO</span></footer>
    </main>
  );
}
