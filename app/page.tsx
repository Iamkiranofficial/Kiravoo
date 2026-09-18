"use client";
import { useEffect, useRef, useState } from "react";
import "./motion.module.css";
import "./kiravo-complete.css";

type Status = "idle" | "generating" | "done" | "error";
type Assistant = { id: string; name: string; gender: string; tag: string; description: string; greeting: string; orb: string };
type Project = { id: string; prompt: string; url?: string; createdAt: string; aspectRatio: string; style: string; duration: number; model: string; name?: string; assistant?: string; language?: string };

const assistants: Assistant[] = [
  { id: "aria", name: "ARIA", gender: "Female", tag: "Visionary", description: "Bold creative thinking, cinematic ideas and confident direction.", greeting: "Let’s turn your idea into something unforgettable.", orb: "◈" },
  { id: "nova", name: "NOVA", gender: "Female", tag: "Energetic", description: "Fast, playful creation with experimental visual energy.", greeting: "Give me the spark. I’ll build the world.", orb: "✦" },
  { id: "luna", name: "LUNA", gender: "Female", tag: "Storyteller", description: "Warm storytelling, emotion, atmosphere and narrative craft.", greeting: "Tell me what you imagine. We’ll give it a story.", orb: "☾" },
  { id: "orion", name: "ORION", gender: "Male", tag: "Precision", description: "Structured thinking, technical control and production precision.", greeting: "Idea received. Let’s engineer the strongest version.", orb: "◎" },
  { id: "atlas", name: "ATLAS", gender: "Male", tag: "Explorer", description: "Research, discovery, planning and ambitious world-building.", greeting: "Let’s explore every direction before we create.", orb: "◇" },
  { id: "kael", name: "KAEL", gender: "Male", tag: "Editor", description: "Polished execution, refinement, pacing and post-production thinking.", greeting: "Bring me the rough idea. I’ll help shape the final cut.", orb: "△" }
];
const languages = ["Auto-detect", "English", "తెలుగు", "हिन्दी", "தமிழ்", "ಕನ್ನಡ", "മലയാളം", "বাংলা", "मराठी", "ગુજરાતી", "ਪੰਜਾਬੀ", "اردو", "Español", "Français", "Deutsch", "Português", "日本語", "한국어", "中文", "العربية"];
const models = [{ id: "ltx-2.3", label: "LTX Video Fast", note: "Free · auto" }, { id: "wan-2.2", label: "Wan 2.2", note: "Detailed" }];
const ratios = ["16:9", "9:16", "1:1"];
const styles = ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"];
const nav = ["Studio", "Create", "Director", "Projects", "Editor", "History", "Explore", "Settings"];
const icons = ["⌂", "✦", "✧", "▣", "◫", "◷", "◇", "⚙"];

export default function Home() {
  const [active, setActive] = useState("Studio");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistant, setAssistant] = useState(assistants[0]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [language, setLanguage] = useState("Auto-detect");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [stage, setStage] = useState("Starting your render…");
  const [videoUrl, setVideoUrl] = useState("");
  const [model, setModel] = useState("ltx-2.3");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [style, setStyle] = useState("Cinematic");
  const [duration, setDuration] = useState(1);
  const [audio, setAudio] = useState(false);\n  const [creditLabel, setCreditLabel] = useState("Auto");
  const [history, setHistory] = useState<Project[]>([]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [mediaMode, setMediaMode] = useState<"image" | "voice">("image");
  const [mediaImage, setMediaImage] = useState<File | null>(null);
  const [mediaAudio, setMediaAudio] = useState<File | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState("");
  const [mediaDuration, setMediaDuration] = useState(5);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durations = model === "wan-2.2" ? [3, 4, 5, 6, 7, 8, 9, 10, 15] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30];

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("kiravo-history") || "[]"));
      const savedAssistant = assistants.find((x) => x.id === localStorage.getItem("kiravo-assistant"));
      if (savedAssistant) setAssistant(savedAssistant);
      setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect");
    } catch {}
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (!durations.includes(duration)) setDuration(durations[0]);
    if (model === "wan-2.2") setAudio(false);
  }, [model, duration, durations]);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const paint = () => { cx += (tx - cx) * 0.1; cy += (ty - cy) * 0.1; root.style.setProperty("--kiravo-mx", cx.toFixed(2)); root.style.setProperty("--kiravo-my", cy.toFixed(2)); raf = requestAnimationFrame(paint); };
    const move = (e: PointerEvent) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener("pointermove", move, { passive: true }); raf = requestAnimationFrame(paint);
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  const chooseAssistant = (x: Assistant) => { setAssistant(x); localStorage.setItem("kiravo-assistant", x.id); setAssistantOpen(false); };
  const chooseLanguage = (x: string) => { setLanguage(x); localStorage.setItem("kiravo-language", x); };
  const navigate = (x: string) => { setActive(x); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveHistory = (project: Project) => setHistory((cur) => { const next = [project, ...cur.filter((x) => x.id !== project.id)].slice(0, 20); localStorage.setItem("kiravo-history", JSON.stringify(next)); return next; });

  async function waitForVideo(id: string, meta?: Partial<Project>) {
    const started = Date.now();
    while (Date.now() - started < 900000) {
      const response = await fetch(`/api/generate/status?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check the render status.");
      if (data.status === "complete" && data.url) {
        const project: Project = { id, prompt: meta?.prompt || prompt.trim(), url: data.url, createdAt: new Date().toISOString(), aspectRatio: meta?.aspectRatio || aspectRatio, style: meta?.style || style, duration: meta?.duration || duration, model: meta?.model || model, name: meta?.name || (meta?.prompt || prompt).slice(0, 42), assistant: assistant.name, language };
        setVideoUrl(data.url); setStatus("done"); saveHistory(project); return;
      }
      if (data.status === "error" || data.status === "canceled") throw new Error(data.error || "The render did not complete.");
      setStage(data.status === "queued" ? "Your render is queued…" : "Rendering your world…");
      await new Promise<void>((resolve) => { timer.current = setTimeout(resolve, 3000); });
    }
    throw new Error("The render is taking longer than expected. Please try again.");
  }

  async function generate() {
    const value = prompt.trim(); if (!value || status === "generating") return;
    setStatus("generating"); setError(""); setVideoUrl(""); setCreditLabel("Auto"); setStage(`${assistant.name} is directing your render…`);
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: value, model, aspectRatio, style, duration, audio, assistant: assistant.id, language }) });
      const data = await response.json(); if (!response.ok || !data.id) throw new Error(data.error || "KIRAVO could not start the video.");
      await waitForVideo(data.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setStatus("error"); }
  }

  async function generateMedia() {
    if (status === "generating" || !mediaImage || (mediaMode === "voice" && !mediaAudio)) return;
    setStatus("generating"); setError(""); setVideoUrl(""); setStage(`${assistant.name} is building your media…`);
    try {
      const form = new FormData(); form.append("mode", mediaMode); form.append("image", mediaImage); if (mediaAudio) form.append("audio", mediaAudio); form.append("prompt", mediaPrompt); form.append("duration", String(mediaDuration)); form.append("model", model); form.append("assistant", assistant.id); form.append("language", language);
      const response = await fetch("/api/generate/media", { method: "POST", body: form }); const data = await response.json(); if (!response.ok || !data.id) throw new Error(data.error || "KIRAVO could not start the media render.");
      await waitForVideo(data.id, { prompt: mediaPrompt || `${mediaMode === "image" ? "Image to Video" : "Voice to Video"} · ${mediaImage.name}`, duration: mediaDuration, model: data.model || model, aspectRatio: "16:9", style: "Cinematic" });
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setStatus("error"); }
  }

  const makeDirector = () => { const p = prompt.trim() || "your idea"; setScenes([`${assistant.name} — Opening: establish the world and mood around ${p}.`, "Scene 02 — Main moment: reveal the subject with controlled cinematic movement.", "Scene 03 — Final shot: resolve the story with a memorable composition."]); };

  return (
    <main className="shell">
      <div className="floating-scene" aria-hidden="true"><div className="float-orb orb-one" /><div className="float-orb orb-two" /><div className="float-ring ring-one" /><div className="float-ring ring-two" /><div className="float-slab slab-one"><span>K</span><small>WORLD 01</small></div><div className="float-slab slab-two"><span>✦</span><small>CREATE</small></div></div>
      <aside className={`workspace-sidebar ${sidebarOpen ? "open" : ""}`}><div className="sidebar-brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><div className="sidebar-label">WORKSPACE</div><div className="sidebar-nav">{nav.map((item, i) => <button key={item} className={`sidebar-link ${active === item ? "active" : ""}`} onClick={() => navigate(item)}><span>{icons[i]}</span><b>{item}</b>{active === item && <i />}</button>)}</div><div className="sidebar-bottom"><div className="sidebar-status"><span className="pulse" /> VIDEO ENGINE <b>ONLINE</b></div><button className="sidebar-home" onClick={() => navigate("Studio")}>← Back to Studio</button></div></aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <div className="workspace-main">
        <nav className="nav"><button className="sidebar-toggle" aria-label="Open workspace menu" onClick={() => setSidebarOpen(true)}>☰</button><div className="brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><div className="nav-links">{nav.slice(0, 5).map((item) => <button key={item} className="nav-link-button" onClick={() => navigate(item)}>{item}</button>)}</div><button className="ghost" onClick={() => navigate("Settings")}>Settings</button></nav>
        <section className="hero">
          <div className="eyebrow"><span className="pulse" /> AI CREATIVE STUDIO · {active.toUpperCase()}</div>
          {active === "Studio" && <>
            <div className="assistant-bar"><button className="assistant-trigger" onClick={() => setAssistantOpen((v) => !v)}><span className="assistant-orb">{assistant.orb}</span><span><small>CREATING WITH</small><strong>{assistant.name}</strong></span><b>⌄</b></button><label className="language-picker"><span>🌐</span><select value={language} onChange={(e) => chooseLanguage(e.target.value)}>{languages.map((x) => <option key={x}>{x}</option>)}</select></label></div>
            {assistantOpen && <div className="assistant-hub"><div className="assistant-hub-head"><div><span className="eyebrow">KIRAVO AI</span><h2>Choose your <em>partner.</em></h2><p>Every assistant can do everything. You choose the personality.</p></div><button className="tool-chip" onClick={() => setAssistantOpen(false)}>Close</button></div><div className="assistant-grid">{assistants.map((x) => <button key={x.id} className={`assistant-card ${assistant.id === x.id ? "selected" : ""}`} onClick={() => chooseAssistant(x)}><span className="assistant-avatar">{x.orb}</span><div><span className="assistant-gender">{x.gender} · {x.tag}</span><h3>{x.name}</h3><p>{x.description}</p></div>{assistant.id === x.id && <i>✓</i>}</button>)}</div><div className="assistant-capabilities"><span>🎬 Video</span><span>🖼️ Image</span><span>🎙️ Voice</span><span>✍️ Writing</span><span>🎨 Design</span><span>✂️ Editing</span><span>🔎 Research</span><span>💻 Tech</span><span>🌍 Multilingual</span></div></div>}
            <h1>Turn an idea into<br /><em>a world.</em></h1><p className="sub">{assistant.name} is ready. {assistant.greeting} KIRAVO creates across desktop, laptop, tablet and mobile.</p>
            <div className="composer"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={`Talk to ${assistant.name} in any language…`} rows={3} disabled={status === "generating"} /><div className="controls"><label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.note}</option>)}</select></label><label>Frame<select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>{ratios.map((x) => <option key={x}>{x}</option>)}</select></label><label>Style<select value={style} onChange={(e) => setStyle(e.target.value)}>{styles.map((x) => <option key={x}>{x}</option>)}</select></label><label>Length<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{durations.map((x) => <option key={x} value={x}>{x}s · Auto credits</option>)}</select></label><button className={`toggle ${audio ? "on" : ""}`} onClick={() => setAudio((v) => !v)} disabled={status === "generating" || model === "wan-2.2"}>{audio ? "●" : "○"} Audio{model === "wan-2.2" ? " · N/A" : ""}</button></div><div className="composer-bottom"><div className="chips"><span>{assistant.name}</span><span>{language}</span><span>{aspectRatio}</span><span>{duration}s</span><span>{creditLabel === "Auto" ? "Auto credits" : creditLabel}</span></div><button className="generate" onClick={generate} disabled={!prompt.trim() || status === "generating"}>{status === "generating" ? "Creating…" : "Generate"} <span>↗</span></button></div></div>
            {status === "generating" && <div className="result-card"><div className="result-orb" /><div><strong>{stage}</strong><p>KIRAVO is rendering with the real video engine. Keep this tab open while the job completes.</p></div><span className="ready">RENDERING</span></div>}
            {status === "error" && <div className="result-card error-card"><div className="result-orb" /><div><strong>Generation failed.</strong><p>{error}</p></div><button className="retry" onClick={generate}>Retry</button></div>}
            {status === "done" && videoUrl && <div className="video-result"><div className="video-head"><div><span className="eyebrow">YOUR KIRAVO WORLD · {assistant.name}</span><h2>Rendered in <em>motion.</em></h2></div><span className="ready">READY</span></div><video src={videoUrl} controls autoPlay playsInline className="generated-video" /><div className="video-actions"><a className="download" href={videoUrl} target="_blank" rel="noreferrer">Open video ↗</a><button className="retry" onClick={() => { setStatus("idle"); setVideoUrl(""); }}>Create another</button></div></div>}
          </>}
          {active !== "Studio" && <button className="inner-back" onClick={() => navigate("Studio")}>← Back to Studio</button>}
          {active === "Create" && <div className="feature-panel"><h2>Create from <em>media.</em></h2><p className="sub">Use a real image-to-video render or combine an image with voice/audio.</p><div className="media-tabs"><button className={mediaMode === "image" ? "active" : ""} onClick={() => setMediaMode("image")}>✦ Image → Video</button><button className={mediaMode === "voice" ? "active" : ""} onClick={() => setMediaMode("voice")}>◉ Voice → Video</button></div><label className="media-upload"><span>{mediaImage ? `✓ ${mediaImage.name}` : "Upload image"}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => setMediaImage(e.target.files?.[0] || null)} /></label>{mediaMode === "voice" && <label className="media-upload"><span>{mediaAudio ? `✓ ${mediaAudio.name}` : "Upload voice / audio"}</span><input type="file" accept="audio/mpeg,audio/wav,audio/aac,audio/flac,audio/mp4,audio/x-m4a" onChange={(e) => setMediaAudio(e.target.files?.[0] || null)} /></label>}<textarea value={mediaPrompt} onChange={(e) => setMediaPrompt(e.target.value)} placeholder={mediaMode === "image" ? "Describe the motion…" : "Describe the visual mood and motion…"} /><div className="media-controls"><label>Duration<select value={mediaDuration} onChange={(e) => setMediaDuration(Number(e.target.value))}>{[3,4,5,6,8,10,15].map((x) => <option key={x} value={x}>{x}s</option>)}</select></label><label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label></div><button className="generate" onClick={generateMedia} disabled={!mediaImage || status === "generating" || (mediaMode === "voice" && !mediaAudio)}>{status === "generating" ? "Creating…" : mediaMode === "image" ? "Animate image ↗" : "Build voice video ↗"}</button></div>}
          {active === "Director" && <div className="feature-panel"><h2>Shape the story before you render.</h2><p className="sub">{assistant.name} turns one prompt into cinematic shots.</p><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your story…" /><button className="generate" onClick={makeDirector}>Build scene plan ↗</button><div className="director-scenes">{scenes.map((s, i) => <article key={i}><span>0{i + 1}</span><div><b>{s.split(" — ")[0]}</b><p>{s.split(" — ")[1]}</p></div></article>)}</div></div>}
          {active === "Projects" && <div className="feature-panel"><h2>Your <em>projects.</em></h2><p className="sub">Saved renders live in this browser.</p>{history.length ? <div className="project-grid">{history.map((x) => <article className="project-card" key={x.id}><video src={x.url} muted playsInline preload="metadata" /><div className="project-card-body"><span className="history-meta">{x.assistant || assistant.name} · {x.language || "Auto-detect"} · {x.model} · {x.duration}s</span><h3>{x.name || x.prompt}</h3><a className="download" href={x.url} target="_blank" rel="noreferrer">Open ↗</a></div></article>)}</div> : <div className="empty-state">No projects yet. Generate your first world in Studio.</div>}</div>}
          {active === "Editor" && <div className="feature-panel"><h2>Motion <em>editor.</em></h2><p className="sub">Open a generated video from Studio to continue editing.</p>{videoUrl ? <video src={videoUrl} controls playsInline className="generated-video" /> : <div className="empty-state">Generate a video first, then use the result in your workflow.</div>}</div>}
          {active === "History" && <div className="feature-panel"><h2>Recent <em>worlds.</em></h2>{history.length ? <div className="history-grid">{history.map((x) => <article key={x.id}><video src={x.url} muted playsInline controls preload="metadata" /><div><span className="history-meta">{x.assistant || assistant.name} · {x.language || "Auto-detect"} · {x.model} · {x.duration}s</span><p>{x.name || x.prompt}</p></div></article>)}</div> : <div className="empty-state">No renders yet.</div>}</div>}
          {active === "Explore" && <div className="feature-panel"><h2>One brain. <em>Six personalities.</em></h2><p className="sub">Every KIRAVO assistant can create, direct, edit, research, write, design and build in any language.</p><div className="cards">{assistants.map((x) => <article key={x.id}><div className="icon">{x.orb}</div><h3>{x.name}</h3><span className="history-meta">{x.gender} · {x.tag}</span><p>{x.description}</p><button className="download" onClick={() => { chooseAssistant(x); navigate("Studio"); }}>Create with {x.name} ↗</button></article>)}</div></div>}
          {active === "Settings" && <div className="feature-panel"><h2>Personalize <em>KIRAVO.</em></h2><p className="sub">Choose your AI partner and language.</p><div className="settings-grid"><label>AI assistant<select value={assistant.id} onChange={(e) => { const x = assistants.find((a) => a.id === e.target.value); if (x) chooseAssistant(x); }}>{assistants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.gender}</option>)}</select></label><label>Language<select value={language} onChange={(e) => chooseLanguage(e.target.value)}>{languages.map((x) => <option key={x}>{x}</option>)}</select></label></div></div>}
        </section>
      </div>
    </main>
  );
}
