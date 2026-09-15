"use client";

import { useEffect, useRef, useState } from "react";

const examples = [
  "A cinematic drone shot flying over Hyderabad at sunset",
  "A tiny robot discovering a glowing forest at midnight",
  "Luxury car commercial on a rain-soaked neon street",
];

const models = [
  { id: "ltx-2.3", label: "LTX 2.3", note: "Fast · audio" },
  { id: "wan-2.2", label: "Wan 2.2", note: "Detailed" },
];
const ratios = ["16:9", "9:16", "1:1"];
const styles = ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"];
const ltxDurations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30];
const wanDurations = [3, 4, 5, 6, 7, 8, 9, 10, 15];

type Status = "idle" | "generating" | "done" | "error";
type HistoryItem = { id: string; prompt: string; url: string; createdAt: string; aspectRatio: string; style: string; duration: number };

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [renderStage, setRenderStage] = useState("Starting your render…");
  const [model, setModel] = useState("ltx-2.3");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [style, setStyle] = useState("Cinematic");
  const [duration, setDuration] = useState(1);
  const [audio, setAudio] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const durationOptions = model === "wan-2.2" ? wanDurations : ltxDurations;
  const estimatedCredits = duration * 24;

  useEffect(() => {
    if (!durationOptions.includes(duration)) setDuration(durationOptions[0]);
    if (model === "wan-2.2" && audio) setAudio(false);
  }, [model]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("kiravo-history") || "[]")); } catch { setHistory([]); }
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, []);

  function saveHistory(item: HistoryItem) {
    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.url !== item.url)].slice(0, 8);
      localStorage.setItem("kiravo-history", JSON.stringify(next));
      return next;
    });
  }

  async function waitForVideo(id: string) {
    const startedAt = Date.now();
    const maxWait = 15 * 60 * 1000;
    while (Date.now() - startedAt < maxWait) {
      const response = await fetch(`/api/generate/status?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check the render status.");
      if (data.status === "complete" && data.url) {
        setVideoUrl(data.url); setStatus("done");
        saveHistory({ id, prompt: prompt.trim(), url: data.url, createdAt: new Date().toISOString(), aspectRatio, style, duration });
        return;
      }
      if (data.status === "error" || data.status === "canceled") throw new Error(data.error || "The video render did not complete.");
      setRenderStage(data.status === "queued" ? "Your render is queued…" : "Rendering your world…");
      await new Promise<void>((resolve) => { pollTimer.current = setTimeout(resolve, 3000); });
    }
    throw new Error("The render is taking longer than expected. Please try again.");
  }

  async function generate() {
    const value = prompt.trim();
    if (!value || status === "generating") return;
    setStatus("generating"); setError(""); setVideoUrl(""); setRenderStage("Starting your render…");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: value, model, aspectRatio, style, duration, audio }) });
      const data = await response.json();
      if (!response.ok || !data.id) throw new Error(data.error || "KIRAVO could not start the video.");
      await waitForVideo(data.id);
    } catch (err) {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      setError(err instanceof Error ? err.message : "Something went wrong."); setStatus("error");
    }
  }

  return (
    <main className="shell">
      <div className="floating-scene" aria-hidden="true">
        <div className="float-orb orb-one" />
        <div className="float-orb orb-two" />
        <div className="float-ring ring-one" />
        <div className="float-ring ring-two" />
        <div className="float-slab slab-one"><span>K</span><small>WORLD 01</small></div>
        <div className="float-slab slab-two"><span>✦</span><small>CREATE</small></div>
      </div>

      <nav className="nav"><div className="brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><div className="nav-links"><a href="#studio">Studio</a><a href="#history">History</a><a href="#works">Explore</a></div><button className="ghost">Sign in</button></nav>
      <section className="hero" id="studio">
        <div className="eyebrow"><span className="pulse" /> AI CREATIVE STUDIO</div>
        <h1>Turn an idea into<br /><em>a world.</em></h1>
        <p className="sub">KIRAVO turns a simple thought into cinematic direction, scenes, motion and visual stories.</p>
        <div className="composer">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the video you imagine..." rows={3} disabled={status === "generating"} />
          <div className="controls">
            <label>Model<select value={model} onChange={(e) => setModel(e.target.value)} disabled={status === "generating"}>{models.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.note}</option>)}</select></label>
            <label>Frame<select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={status === "generating"}>{ratios.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Style<select value={style} onChange={(e) => setStyle(e.target.value)} disabled={status === "generating"}>{styles.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Length<select value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={status === "generating"}>{durationOptions.map((item) => <option key={item} value={item}>{item}s · ~{item * 24} credits</option>)}</select></label>
            <button type="button" className={`toggle ${audio ? "on" : ""}`} onClick={() => setAudio(!audio)} disabled={status === "generating" || model === "wan-2.2"}><span>{audio ? "●" : "○"}</span> Audio{model === "wan-2.2" ? " · N/A" : ""}</button>
          </div>
          <div className="composer-bottom"><div className="chips"><span>{aspectRatio}</span><span>{duration}s</span><span>{style}</span><span>~{estimatedCredits} credits</span></div><button className="generate" onClick={generate} disabled={!prompt.trim() || status === "generating"}>{status === "generating" ? "Creating…" : "Generate"} <span>{status === "generating" ? "◌" : "↗"}</span></button></div>
        </div>
        <div className="suggestions"><span>Try an idea</span>{examples.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
        {status === "generating" && <div className="result-card"><div className="result-orb" /><div><strong>{renderStage}</strong><p>KIRAVO is rendering your direction. Keep this tab open while the video is being created.</p></div><span className="ready">RENDERING</span></div>}
        {status === "error" && <div className="result-card error-card"><div className="result-orb" /><div><strong>Generation failed.</strong><p>{error}</p></div><button className="retry" onClick={generate}>Retry</button></div>}
        {status === "done" && videoUrl && <div className="video-result"><div className="video-head"><div><span className="eyebrow">YOUR KIRAVO WORLD</span><h2>Rendered in <em>motion.</em></h2></div><span className="ready">{duration} SEC · {aspectRatio}</span></div><video src={videoUrl} controls autoPlay playsInline className={`generated-video ratio-${aspectRatio.replace(":", "-")}`} /><div className="video-actions"><a className="download" href={videoUrl} target="_blank" rel="noreferrer">Open video ↗</a><button className="retry" onClick={generate}>Create another</button></div></div>}
      </section>
      {history.length > 0 && <section className="history" id="history"><div className="section-head"><div><span className="eyebrow">YOUR CREATIONS</span><h2>Recent <em>worlds.</em></h2></div><span className="index">{history.length} SAVED</span></div><div className="history-grid">{history.map((item) => <article key={item.id}><video src={item.url} muted playsInline preload="metadata" /><div><span className="history-meta">{item.aspectRatio} · {item.style} · {item.duration}s</span><p>{item.prompt}</p><a href={item.url} target="_blank" rel="noreferrer">Open ↗</a></div></article>)}</div></section>}
      <section className="works" id="works"><div className="section-head"><div><span className="eyebrow">THE KIRAVO METHOD</span><h2>From thought to <em>motion.</em></h2></div><span className="index">01 — 03</span></div><div className="cards"><article><span className="number">01</span><div className="icon">✦</div><h3>Imagine</h3><p>Start with words. KIRAVO understands mood, camera language, setting and story.</p></article><article><span className="number">02</span><div className="icon">◈</div><h3>Direct</h3><p>Shape your idea with model, frame, style, duration and audio controls before rendering.</p></article><article><span className="number">03</span><div className="icon">↗</div><h3>Create</h3><p>Render with a real video model and keep your creations available in this browser.</p></article></div></section>
      <footer id="about"><div className="brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><span>Make something nobody has seen before.</span><span>© 2026 KIRAVO</span></footer>
    </main>
  );
}
