"use client";

import { useState } from "react";

const examples = [
  "A cinematic drone shot flying over Hyderabad at sunset",
  "A tiny robot discovering a glowing forest at midnight",
  "Luxury car commercial on a rain-soaked neon street",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [generated, setGenerated] = useState(false);

  function generate() {
    if (!prompt.trim()) return;
    setGenerated(true);
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
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the video you imagine..." rows={3} />
          <div className="composer-bottom">
            <div className="chips"><button>16:9</button><button>10s</button><button>🎬 Cinematic</button></div>
            <button className="generate" onClick={generate}>Generate <span>↗</span></button>
          </div>
        </div>

        <div className="suggestions">
          <span>Try an idea</span>
          {examples.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}
        </div>

        {generated && <div className="result-card"><div className="result-orb" /><div><strong>Concept ready.</strong><p>KIRAVO has shaped your prompt into a cinematic direction. Connect a video model to render the final sequence.</p></div><span className="ready">READY</span></div>}
      </section>

      <section className="works" id="works">
        <div className="section-head"><div><span className="eyebrow">THE KIRAVO METHOD</span><h2>From thought to <em>motion.</em></h2></div><span className="index">01 — 03</span></div>
        <div className="cards">
          <article><span className="number">01</span><div className="icon">✦</div><h3>Imagine</h3><p>Start with words. KIRAVO understands mood, camera language, setting and story.</p></article>
          <article><span className="number">02</span><div className="icon">◈</div><h3>Direct</h3><p>Shape your idea into scenes, shots and a coherent visual direction you can actually make.</p></article>
          <article><span className="number">03</span><div className="icon">↗</div><h3>Create</h3><p>Render with the creative tools you choose. Keep the concept yours from first frame to final cut.</p></article>
        </div>
      </section>

      <footer id="about"><div className="brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><span>Make something nobody has seen before.</span><span>© 2026 KIRAVO</span></footer>
    </main>
  );
}
