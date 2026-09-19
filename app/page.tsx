"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./motion.module.css";
import "./kiravo-complete.css";
import "./kiravo-reference-assets.css";

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
const nav = ["Studio", "Create", "Editor", "Director", "Enhance", "Create", "Projects"];
const icons = ["⌂", "✦", "✧", "▤", "▣", "◫", "◷", "◇", "⚙"];

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
  const [audio, setAudio] = useState(false);
  const [creditLabel, setCreditLabel] = useState("Auto");
  const [history, setHistory] = useState<Project[]>([]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [directorThinking, setDirectorThinking] = useState(false);
  const [directorPlan, setDirectorPlan] = useState("");
  const [scenePrompts, setScenePrompts] = useState<string[]>([]);
  const [sceneResults, setSceneResults] = useState<Array<{ scene: number; url: string }>>([]);
  const [filmBuilding, setFilmBuilding] = useState(false);
  const [mediaMode, setMediaMode] = useState<"image" | "voice">("image");
  const [mediaImage, setMediaImage] = useState<File | null>(null);
  const [mediaAudio, setMediaAudio] = useState<File | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState("");
  const [mediaDuration, setMediaDuration] = useState(5);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [promptMode, setPromptMode] = useState<"story" | "shot" | "product">("story");
  const [copied, setCopied] = useState(false);
  const [lastProjectId, setLastProjectId] = useState("");
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durations = model === "wan-2.2" ? [3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("kiravo-history") || "[]"));
      const savedAssistant = assistants.find((x) => x.id === localStorage.getItem("kiravo-assistant"));
      if (savedAssistant) setAssistant(savedAssistant);
      setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect");
      const remixPrompt = localStorage.getItem("kiravo-remix-prompt");
      const remixStyle = localStorage.getItem("kiravo-remix-style");
      const remixRatio = localStorage.getItem("kiravo-remix-ratio");
      const remixDuration = Number(localStorage.getItem("kiravo-remix-duration") || 0);
      if (remixPrompt) { setPrompt(remixPrompt); localStorage.removeItem("kiravo-remix-prompt"); }
      if (remixStyle && styles.includes(remixStyle)) { setStyle(remixStyle); localStorage.removeItem("kiravo-remix-style"); }
      if (remixRatio && ratios.includes(remixRatio)) { setAspectRatio(remixRatio); localStorage.removeItem("kiravo-remix-ratio"); }
      if (remixDuration >= 1 && remixDuration <= 8) { setDuration(remixDuration); localStorage.removeItem("kiravo-remix-duration"); }
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
  const navigate = (x: string) => {
    if (x === "Dashboard") {
      router.push("/dashboard");
      setSidebarOpen(false);
      return;
    }
    const update = () => { setActive(x); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
    const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doc.startViewTransition(update);
    } else {
      update();
    }
  };
  const saveHistory = (project: Project) => setHistory((cur) => { const next = [project, ...cur.filter((x) => x.id !== project.id)].slice(0, 20); localStorage.setItem("kiravo-history", JSON.stringify(next)); return next; });

  async function waitForVideo(id: string, meta?: Partial<Project>) {
    const started = Date.now();
    while (Date.now() - started < 900000) {
      const response = await fetch(`/api/generate/status?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check the render status.");
      if (data.status === "complete" && data.url) {
        const project: Project = { id, prompt: meta?.prompt || prompt.trim(), url: data.url, createdAt: new Date().toISOString(), aspectRatio: meta?.aspectRatio || aspectRatio, style: meta?.style || style, duration: meta?.duration || duration, model: meta?.model || model, name: meta?.name || (meta?.prompt || prompt).slice(0, 42), assistant: assistant.name, language };
        setVideoUrl(data.url); setLastProjectId(id); setStatus("done"); saveHistory(project); return;
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
      let response: Response;
      if (sourceImage) {
        const form = new FormData();
        form.append("mode", "image");
        form.append("image", sourceImage);
        form.append("prompt", value);
        form.append("duration", String(duration));
        form.append("model", model);
        form.append("assistant", assistant.id);
        form.append("language", language);
        response = await fetch("/api/generate/media", { method: "POST", body: form, cache: "no-store" });
      } else {
        response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: value, model, aspectRatio, style, duration, audio, assistant: assistant.id, language }), cache: "no-store" });
      }
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`KIRAVO server returned invalid JSON (HTTP ${response.status}).`); }
      if (!response.ok || !data.id) throw new Error(data.error || "KIRAVO could not start the video.");
      setCreditLabel(data.creditsCharged === 0 ? "Free" : typeof data.creditsCharged === "number" ? `${data.creditsCharged} credits` : "Auto");
      await waitForVideo(data.id, sourceImage ? { prompt: value, duration, model: data.model || model, aspectRatio, style } : undefined);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setStatus("error"); }
  }

  const directPrompt = async () => {
    const base = prompt.trim();
    if (!base || directorThinking) return;
    setDirectorThinking(true);
    setError("");
    try {
      const response = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: base,
          assistantName: assistant.name,
          assistantTag: assistant.tag,
          style,
          aspectRatio,
          duration,
          language
        }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI Director could not plan the video.");
      if (data.prompt) setPrompt(String(data.prompt).slice(0, 1000));
      if (Array.isArray(data.scenes)) setScenes(data.scenes);
      if (Array.isArray(data.scenePrompts)) setScenePrompts(data.scenePrompts);
      if (data.plan) setDirectorPlan(String(data.plan));
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI Director failed.");
    } finally {
      setDirectorThinking(false);
    }
  };

  const buildFullFilm = async () => {
    if (filmBuilding || !prompt.trim()) return;
    setFilmBuilding(true);
    setError("");
    setSceneResults([]);
    setStatus("generating");
    try {
      setStage("KIRAVO Director is planning the scenes…");
      const directorResponse = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), assistantName: assistant.name, assistantTag: assistant.tag, style, aspectRatio, duration, language }),
        cache: "no-store"
      });
      const directorData = await directorResponse.json();
      if (!directorResponse.ok) throw new Error(directorData.error || "AI Director could not create the scene plan.");
      const prompts = Array.isArray(directorData.scenePrompts) ? directorData.scenePrompts.slice(0, 4).map(String) : [];
      if (!prompts.length) throw new Error("AI Director did not return scene prompts.");
      if (directorData.prompt) setPrompt(String(directorData.prompt).slice(0, 1000));
      if (Array.isArray(directorData.scenes)) setScenes(directorData.scenes);
      if (directorData.plan) setDirectorPlan(String(directorData.plan));
      setScenePrompts(prompts);

      const completed: Array<{ scene: number; url: string }> = [];
      for (let i = 0; i < prompts.length; i++) {
        setStage("Generating scene " + (i + 1) + " of " + prompts.length + "…");
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompts[i], model: "ltx-2.3", aspectRatio, style, duration, audio: false, assistant: assistant.id, language }),
          cache: "no-store"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.id) throw new Error(data.error || "Scene " + (i + 1) + " could not start.");
        const started = Date.now();
        let finished = false;
        while (Date.now() - started < 900000) {
          const statusResponse = await fetch("/api/generate/status?id=" + encodeURIComponent(data.id), { cache: "no-store" });
          const statusData = await statusResponse.json().catch(() => ({}));
          if (!statusResponse.ok) throw new Error(statusData.error || "Could not check scene " + (i + 1) + ".");
          if (statusData.status === "complete" && statusData.url) {
            completed.push({ scene: i + 1, url: statusData.url });
            setSceneResults([...completed]);
            finished = true;
            break;
          }
          if (statusData.status === "error" || statusData.status === "canceled") throw new Error(statusData.error || "Scene " + (i + 1) + " failed.");
          await new Promise<void>((resolve) => { timer.current = setTimeout(resolve, 3000); });
        }
        if (!finished) throw new Error("Scene " + (i + 1) + " timed out.");
      }
      setStage("All scenes generated.");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Film generation failed.");
      setStatus("error");
    } finally {
      setFilmBuilding(false);
    }
  };

  const assembleFilm = async () => {
    if (filmBuilding || sceneResults.length < 2) return;
    setFilmBuilding(true);
    setStatus("generating");
    setError("");
    setStage("Assembling your final film…");
    try {
      const response = await fetch("/api/film/concat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: sceneResults.map((scene) => scene.url) }),
        cache: "no-store"
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "KIRAVO could not assemble the final film.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setLastProjectId("film-" + Date.now());
      setStatus("done");
      setStage("Final film ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Final film assembly failed.");
      setStatus("error");
    } finally {
      setFilmBuilding(false);
    }
  };

  const enhancePrompt = () => {
    const base = prompt.trim();
    if (!base) return;
    const suffix = promptMode === "shot"
      ? " cinematic shot design, deliberate camera movement, foreground depth, realistic lighting, strong composition, natural motion"
      : promptMode === "product"
        ? " premium commercial film, controlled studio lighting, elegant camera movement, refined materials, photorealistic detail"
        : " cinematic storytelling, atmospheric depth, intentional pacing, natural motion, polished film lighting, high detail";
    setPrompt(`${base.replace(/[. ]+$/, "")},${suffix}.`);
  };
  const applySuggestion = (text: string) => setPrompt(text);
  const clearPrompt = () => { setPrompt(""); setSourceImage(null); setStatus("idle"); setError(""); setVideoUrl(""); setLastProjectId(""); };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  };
  const remixProject = () => { setStatus("idle"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const shareProject = () => {
    if (!videoUrl) return;
    const payload = { id: `share-${Date.now()}`, prompt, url: videoUrl, createdAt: new Date().toISOString(), aspectRatio, style, duration, model, name: prompt.slice(0, 42), assistant: assistant.name, language };
    router.push(`/share?p=${btoa(encodeURIComponent(JSON.stringify(payload)))}`);
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
      <aside className={`workspace-sidebar ${sidebarOpen ? "open" : ""}`}><div className="sidebar-brand"><span className="brand-mark">K</span><span>KIRAVO</span></div><div className="sidebar-label">CREATE</div><div className="sidebar-nav">
{[
  ["Studio","Video","▣"],["Create","Image","▧"],["Editor","Edit","✎"],["Director","Animate","✧"],["Enhance","Enhance","✦"],["Create","Audio","♫"],["Projects","Assets","□"]
].map(([route,label,icon], i) => <button key={label} className={`sidebar-link ${active === route && ((label === "Video" && route === "Studio") || label !== "Video") ? "active" : ""}`} onClick={() => label === "Enhance" ? directPrompt() : navigate(route)}><span>{icon}</span><b>{label}</b>{((label === "Video" && active === "Studio") || (label === "Image" && active === "Create") || (label === "Edit" && active === "Editor") || (label === "Animate" && active === "Director")) && <i />}</button>)}
</div>
<div className="sidebar-pro"><div className="sidebar-pro-title">♛ <span>KIRAVO PRO</span></div><p>Higher limits<br/>Faster generation<br/>Exclusive models<br/>Early access</p><button onClick={() => navigate("Settings")}>Upgrade</button></div>
<div className="sidebar-quote">“Ideas today<br/><em>Cinematic tomorrow.</em>”<span>— KIRAVO</span></div></aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <div className="workspace-main">
        <nav className="nav kiravo-topnav"><button className="sidebar-toggle" aria-label="Open workspace menu" onClick={() => setSidebarOpen(true)}>☰</button><div className="brand kiravo-wordmark"><span>KIRAVO</span><small>CREATE BEYOND REALITY</small></div><div className="nav-links"><button className={`nav-link-button ${active === "Studio" ? "active" : ""}`} onClick={() => navigate("Studio")}>Home</button><button className="nav-link-button" onClick={() => navigate("Create")}>Create</button><button className="nav-link-button" onClick={() => navigate("Settings")}>Models</button><button className="nav-link-button" onClick={() => navigate("Explore")}>Gallery</button><button className="nav-link-button" onClick={() => navigate("Editor")}>Tools</button><button className="nav-link-button" onClick={() => navigate("Settings")}>Pricing</button><button className="nav-link-button" onClick={() => navigate("Explore")}>Community</button></div><div className="nav-actions"><button className="nav-icon">⌕</button><button className="nav-icon">♧</button><button className="profile">KB</button><span className="profile-copy"><b>Kiran</b><small>Creator</small></span><button className="nav-icon">⌄</button></div></nav>
        <section className="hero">
          {active !== "Studio" && <div className="eyebrow"><span className="pulse" /> AI CREATIVE STUDIO · {active.toUpperCase()}</div>}
          {active === "Studio" && <>
            <div className="kiravo-hero">
              <div className="kiravo-hero-copy">
                <div className="hero-kicker">AI VIDEO GENERATION STUDIO</div>
                <h1>Turn Your Ideas<br />Into Cinematic <em>Reality</em></h1>
                <p>Your imagination. Our intelligence. Infinite possibilities.</p>
              </div>
              <div className="kiravo-hero-figure" aria-hidden="true"><div className="hero-crown">♛</div><div className="hero-statue"><span>K</span></div><div className="hero-moon" /></div>
              <div className="hero-mantra"><span>DREAM</span><span>CREATE</span><span>GENERATE</span><span>REPEAT</span></div>
            </div>

            <div className="premium-composer">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your video…" rows={2} disabled={status === "generating"} />
              <div className="premium-composer-bottom">
                <label className={`image-add ${sourceImage ? "selected" : ""}`}><input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={(e) => setSourceImage(e.target.files?.[0] || null)} />▧ <span>{sourceImage ? sourceImage.name : "Add Image (Optional)"}</span></label>
                <span className="prompt-count">{prompt.length}/1000</span>
                <button className={`tune-button ${advancedOpen ? "active" : ""}`} type="button" onClick={() => setAdvancedOpen((x) => !x)} aria-expanded={advancedOpen}>☷</button><button className="enhance-prompt" onClick={directPrompt} disabled={!prompt.trim() || directorThinking}>{directorThinking ? "◌ Director thinking…" : "✦ AI Director"}</button><button className="enhance-prompt" onClick={buildFullFilm} disabled={!prompt.trim() || filmBuilding}>{filmBuilding ? "◌ Building scenes…" : "✦ Build Film"}</button>{sceneResults.length >= 2 && <button className="enhance-prompt" onClick={assembleFilm} disabled={filmBuilding}>{filmBuilding ? "◌ Assembling…" : "✦ Create Final Film"}</button>}<button className="enhance-prompt quick-enhance" type="button" onClick={enhancePrompt} disabled={!prompt.trim()}>✦ Enhance prompt</button>
                <button className="premium-generate" onClick={generate} disabled={!prompt.trim() || status === "generating"}><span>✦</span>{status === "generating" ? "Generating…" : sourceImage ? "Animate image" : "Generate"} <b>→</b></button>
              </div>
            </div>

            {status === "generating" && <div className="result-card kiravo-loading" aria-live="polite"><div className="kiravo-letter-loader" aria-hidden="true"><span>K</span><span>I</span><span>R</span><span>A</span><span>V</span><span>O</span></div><div className="kiravo-loading-copy"><span className="eyebrow">KIRAVO IS CREATING</span><strong>{stage}</strong><p>Building your cinematic world.</p></div><span className="ready">RENDERING</span></div>}
            {status === "error" && <div className="result-card error-card"><div className="result-orb" /><div><strong>Generation failed.</strong><p>{error}</p></div><button className="retry" onClick={generate}>Retry</button></div>}
            {status === "done" && videoUrl && <div className="video-result premium-result">
  <div className="video-head"><div><span className="eyebrow">YOUR KIRAVO WORLD · {assistant.name}</span><h2>Rendered in <em>motion.</em></h2><p className="result-meta">{model} · {style} · {aspectRatio} · {duration}s · {creditLabel}</p></div><span className="ready">READY</span></div>
  <div className="result-stage"><video src={videoUrl} controls autoPlay playsInline className="generated-video" /></div>
  <div className="result-actions"><a className="download" href={videoUrl} target="_blank" rel="noreferrer">Open video ↗</a><a className="download" href={videoUrl} download>Download ↓</a><button className="retry" onClick={remixProject}>↻ Remix</button><button className="retry" onClick={()=>lastProjectId && router.push(`/editor?project=${encodeURIComponent(lastProjectId)}`)}>✂ Edit</button><button className="retry" onClick={shareProject}>⌁ Share</button><button className="retry" onClick={clearPrompt}>＋ New</button></div>
  <div className="result-insight"><span>✦ {assistant.name} direction</span><p>{prompt}</p></div>
</div>}


            {advancedOpen && <div className="studio-control-tray">
  <div className="studio-tray-head"><div><span className="eyebrow">DIRECTOR CONTROLS</span><h3>Shape the render.</h3></div><button className="tool-chip" onClick={() => setAdvancedOpen(false)}>Done</button></div>
  <div className="studio-control-grid">
    <label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.note}</option>)}</select></label>
    <label>Aspect ratio<select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>{ratios.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Style<select value={style} onChange={(e) => setStyle(e.target.value)}>{styles.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Duration<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{durations.map((x) => <option key={x} value={x}>{x}s</option>)}</select></label>
    <label>AI partner<select value={assistant.id} onChange={(e) => { const x = assistants.find((a) => a.id === e.target.value); if (x) chooseAssistant(x); }}>{assistants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.tag}</option>)}</select></label>
    <label>Language<select value={language} onChange={(e) => chooseLanguage(e.target.value)}>{languages.map((x) => <option key={x}>{x}</option>)}</select></label>
  </div>
  <div className="studio-tray-row"><div className="prompt-mode"><button className="enhance-prompt" onClick={directPrompt} disabled={!prompt.trim() || directorThinking}>{directorThinking ? "◌ Director thinking…" : "✦ AI Director"}</button><button className="enhance-prompt" onClick={buildFullFilm} disabled={!prompt.trim() || filmBuilding}>{filmBuilding ? "◌ Building scenes…" : "✦ Build Film"}</button><button className="enhance-prompt quick-enhance" onClick={enhancePrompt} disabled={!prompt.trim()}>✦ Enhance prompt</button><span>Prompt mode</span>{[["story","Story"],["shot","Shot"],["product","Product"]].map(([id,label])=><button key={id} className={promptMode===id?"active":""} onClick={()=>setPromptMode(id as typeof promptMode)}>{label}</button>)}</div><button className="enhance-prompt" onClick={enhancePrompt}>✦ Enhance prompt</button><button className="copy-prompt" onClick={copyPrompt}>{copied ? "Copied ✓" : "Copy prompt"}</button><button className={audio ? "audio-toggle on" : "audio-toggle"} onClick={()=>setAudio((x)=>!x)} disabled={model==="wan-2.2"}>Audio {audio ? "On" : "Off"}</button></div>
  {sourceImage && <div className="reference-pill">▧ Reference image ready · {sourceImage.name}<button onClick={()=>setSourceImage(null)}>Remove</button></div>}
</div>}
<div className="director-ai-plan" aria-live="polite">{directorPlan && <p>{directorPlan}</p>}{scenes.length > 0 && <div>{scenes.map((scene,i)=><span key={i}>{String(i+1).padStart(2,"0")} · {scene}</span>)}</div>}{sceneResults.length > 0 && <div>{sceneResults.map((item)=><span key={item.scene}>Scene {String(item.scene).padStart(2,"0")} · <a href={item.url} target="_blank" rel="noreferrer">Open clip ↗</a></span>)}</div>}</div><div className="studio-suggestions"><span>START WITH</span><button onClick={()=>applySuggestion("A cinematic drone shot flying over Hyderabad at sunset, warm haze, slow camera movement, realistic city detail")}>Hyderabad at sunset</button><button onClick={()=>applySuggestion("A luxury fashion film in a rain-soaked neon street, elegant camera movement, glossy reflections")}>Neon fashion</button><button onClick={()=>applySuggestion("A lone astronaut discovers an ancient glowing temple on an alien planet, epic cinematic lighting")}>Alien temple</button><button onClick={()=>applySuggestion("A premium product commercial for a futuristic smartphone, black studio, dramatic rim light")}>Product film</button></div>
            <section className="models-section">
              <div className="section-heading"><div><h2>Our Models</h2><p>Built for creators. Designed for the extraordinary.</p></div><button onClick={() => navigate("Settings")}>View All Models →</button></div>
              <div className="model-showcase">
                <article className="model-card model-cinema"><div className="model-badge">K</div><span className="model-pill">OUR MODEL</span><div className="model-copy"><h3>KIRAVO CINEMA</h3><p>Ultra realistic. Cinematic perfection for any idea.</p><small>TEXT → VIDEO</small><small>IMAGE → VIDEO</small></div></article>
                <article className="model-card model-real"><div className="model-badge">K</div><span className="model-pill">OUR MODEL</span><div className="model-copy"><h3>KIRAVO REAL</h3><p>Natural, lifelike videos with smooth motion.</p><small>TEXT → VIDEO</small><small>IMAGE → VIDEO</small></div></article>
                <article className="model-card model-anime"><div className="model-badge">K</div><span className="model-pill">OUR MODEL</span><div className="model-copy"><h3>KIRAVO ANIME</h3><p>Stunning anime style generation with consistent characters.</p><small>TEXT → VIDEO</small><small>IMAGE → VIDEO</small></div></article>
                <article className="model-card model-flow"><div className="model-badge">K</div><span className="model-pill">OUR MODEL</span><div className="model-copy"><h3>KIRAVO FLOW</h3><p>Image to video, video to video with smooth transitions.</p><small>VIDEO → VIDEO</small><small>STYLE TRANSFER</small></div></article>
              </div>
            </section>

            <section className="showcase-section">
              <div className="showcase-tabs"><h2>Showcase</h2><button className="active">Trending</button><button>Cinematic</button><button>Realistic</button><button>Anime</button><button>Creative</button><span /><button onClick={() => navigate("Explore")}>View All →</button></div>
              <div className="showcase-grid">
                <article><div className="showcase-art city"><span>▶ 0:08</span></div><h3>Sunset Over Hyderabad</h3><p>by KIRAVO <b>♡ 2.4K · ⋮</b></p></article>
                <article><div className="showcase-art mountains"><span>▶ 0:06</span></div><h3>Beyond the Clouds</h3><p>by KIRAVO <b>♡ 1.1K · ⋮</b></p></article>
                <article><div className="showcase-art lion"><span>▶ 0:07</span></div><h3>The Silent King</h3><p>by KIRAVO <b>♡ 3.2K · ⋮</b></p></article>
                <article><div className="showcase-art car"><span>▶ 0:05</span></div><h3>Urban Pulse</h3><p>by KIRAVO <b>♡ 1.8K · ⋮</b></p></article>
              </div>
            </section>

            {assistantOpen && <div className="assistant-hub"><div className="assistant-hub-head"><div><span className="eyebrow">KIRAVO AI</span><h2>Choose your <em>partner.</em></h2><p>Every assistant can do everything. You choose the personality.</p></div><button className="tool-chip" onClick={() => setAssistantOpen(false)}>Close</button></div><div className="assistant-grid">{assistants.map((x) => <button key={x.id} className={`assistant-card ${assistant.id === x.id ? "selected" : ""}`} onClick={() => chooseAssistant(x)}><span className="assistant-avatar">{x.orb}</span><div><span className="assistant-gender">{x.gender} · {x.tag}</span><h3>{x.name}</h3><p>{x.description}</p></div>{assistant.id === x.id && <i>✓</i>}</button>)}</div></div>}
          </>}
          {active !== "Studio" && <><div className={`page-masthead page-${active.toLowerCase()}`}><div><span className="hero-kicker">KIRAVO CREATIVE WORKSPACE</span><h2>{active === "Create" ? <>Create <em>in motion.</em></> : active === "Director" ? <>Direct the <em>story.</em></> : active === "Projects" ? <>Your <em>worlds.</em></> : active === "Editor" ? <>Craft the <em>final cut.</em></> : active === "History" ? <>Your creative <em>history.</em></> : active === "Settings" ? <>Shape your <em>KIRAVO.</em></> : <>Explore <em>the impossible.</em></>}</h2><p>Premium creative tools, cinematic control and a workspace designed around your ideas.</p></div><div className="masthead-symbol">K</div></div><button className="inner-back" onClick={() => navigate("Studio")}>← Back to Studio</button></>}
          {active === "Create" && <div className="feature-panel"><h2>Create from <em>media.</em></h2><p className="sub">Use a real image-to-video render or combine an image with voice/audio.</p><div className="media-tabs"><button className={mediaMode === "image" ? "active" : ""} onClick={() => setMediaMode("image")}>✦ Image → Video</button><button className={mediaMode === "voice" ? "active" : ""} onClick={() => setMediaMode("voice")}>◉ Voice → Video</button></div><label className="media-upload"><span>{mediaImage ? `✓ ${mediaImage.name}` : "Upload image"}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => setMediaImage(e.target.files?.[0] || null)} /></label>{mediaMode === "voice" && <label className="media-upload"><span>{mediaAudio ? `✓ ${mediaAudio.name}` : "Upload voice / audio"}</span><input type="file" accept="audio/mpeg,audio/wav,audio/aac,audio/flac,audio/mp4,audio/x-m4a" onChange={(e) => setMediaAudio(e.target.files?.[0] || null)} /></label>}<textarea value={mediaPrompt} onChange={(e) => setMediaPrompt(e.target.value)} placeholder={mediaMode === "image" ? "Describe the motion…" : "Describe the visual mood and motion…"} /><div className="media-controls"><label>Duration<select value={mediaDuration} onChange={(e) => setMediaDuration(Number(e.target.value))}>{[3,4,5,6,8,10,15].map((x) => <option key={x} value={x}>{x}s</option>)}</select></label><label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label></div><button className="generate" onClick={generateMedia} disabled={!mediaImage || status === "generating" || (mediaMode === "voice" && !mediaAudio)}>{status === "generating" ? "Creating…" : mediaMode === "image" ? "Animate image ↗" : "Build voice video ↗"}</button></div>}
          {active === "Director" && <div className="feature-panel"><h2>Shape the story before you render.</h2><p className="sub">{assistant.name} turns one prompt into cinematic shots.</p><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your story…" /><button className="generate" onClick={makeDirector}>Build scene plan ↗</button><div className="director-scenes">{scenes.map((s, i) => <article key={i}><span>0{i + 1}</span><div><b>{s.split(" — ")[0]}</b><p>{s.split(" — ")[1]}</p></div></article>)}</div></div>}
          {active === "Projects" && <div className="feature-panel"><h2>Your <em>projects.</em></h2><p className="sub">Saved renders live in this browser.</p>{history.length ? <div className="project-grid">{history.map((x) => <article className="project-card" key={x.id}><video src={x.url} muted playsInline preload="metadata" /><div className="project-card-body"><span className="history-meta">{x.assistant || assistant.name} · {x.language || "Auto-detect"} · {x.model} · {x.duration}s</span><h3>{x.name || x.prompt}</h3><a className="download" href={x.url} target="_blank" rel="noreferrer">Open ↗</a></div></article>)}</div> : <div className="empty-state">No projects yet. Generate your first world in Studio.</div>}</div>}
          {active === "Editor" && <div className="feature-panel"><h2>Motion <em>editor.</em></h2><p className="sub">Open a generated video from Studio to continue editing.</p>{videoUrl ? <video src={videoUrl} controls playsInline className="generated-video" /> : <div className="empty-state">Generate a video first, then use the result in your workflow.</div>}</div>}
          {active === "History" && <div className="feature-panel"><h2>Recent <em>worlds.</em></h2>{history.length ? <div className="history-grid">{history.map((x) => <article key={x.id}><video src={x.url} muted playsInline controls preload="metadata" /><div><span className="history-meta">{x.assistant || assistant.name} · {x.language || "Auto-detect"} · {x.model} · {x.duration}s</span><p>{x.name || x.prompt}</p></div></article>)}</div> : <div className="empty-state">No renders yet.</div>}</div>}
          {active === "Explore" && <div className="explore-page">
  <div className="explore-head">
    <div><span className="eyebrow">KIRAVO VISUAL LIBRARY · CURATED WORLDS</span><h2>Explore <em>the impossible.</em></h2><p className="sub">A living gallery of cinematic worlds, characters, products and stories created inside KIRAVO.</p></div>
    <button className="explore-create" onClick={() => navigate("Studio")}>Create something ↗</button>
  </div>
  <div className="explore-filters">{["All","Cinematic","Portrait","Fashion","Architecture","Fantasy","Automotive","India"].map((x,i)=><button key={x} className={i===0?"active":""}>{x}</button>)}</div>
  <div className="explore-feature">
    <div className="explore-visual visual-hero"><span className="visual-kicker">FEATURED WORLD · KIRAVO CINEMA</span><div><strong>Golden hour<br/>over Hyderabad.</strong><p>Atmospheric · Cinematic · 16:9</p></div><button onClick={()=>{setPrompt("A cinematic aerial shot over Hyderabad at golden hour, warm atmospheric haze, elegant film lighting");navigate("Studio")}}>Use this direction ↗</button></div>
    <div className="explore-feature-copy"><span className="history-meta">EDITOR'S PICK · SEPTEMBER 2026</span><h3>Where reality meets imagination.</h3><p>Discover visual directions and turn any frame into your next KIRAVO creation.</p><div className="explore-stats"><span><b>50+</b> worlds</span><span><b>8</b> styles</span><span><b>24</b> moods</span></div></div>
  </div>
  <div className="explore-grid">
    {[
      ["Midnight Couture","Fashion · Editorial","visual-couture","Fashion"],
      ["Desert Monolith","Architecture · Cinema","visual-desert","Architecture"],
      ["Neon Pursuit","Automotive · Motion","visual-auto","Automotive"],
      ["The Last Garden","Fantasy · Dreamy","visual-garden","Fantasy"],
      ["Royal Portrait","Portrait · Realistic","visual-portrait","Portrait"],
      ["Monsoon City","India · Cinematic","visual-india","India"],
      ["Chrome Future","Sci-Fi · Commercial","visual-chrome","Cinematic"],
      ["Moonlit Palace","Fantasy · Architecture","visual-palace","Fantasy"]
    ].map(([title,meta,visual,tag],i)=><article className="explore-card" key={title}>
      <div className={`explore-art ${visual}`}><span className="art-tag">{tag}</span><button aria-label={`Create similar to ${title}`} onClick={()=>{setPrompt(`Create a cinematic visual inspired by ${title}, ${meta}, premium lighting, high detail`);navigate("Studio")}}>↗</button><span className="art-grain"/></div>
      <div className="explore-card-body"><div><span className="history-meta">{meta}</span><h3>{title}</h3></div><span className="art-index">0{i+1}</span></div>
    </article>)}
  </div>
  <div className="explore-assistants"><div><span className="eyebrow">CREATE WITH A DIRECTOR</span><h3>Six minds. One visual language.</h3></div><div className="explore-assistant-row">{assistants.map(x=><button key={x.id} onClick={()=>{chooseAssistant(x);navigate("Studio")}}><span>{x.orb}</span><div><b>{x.name}</b><small>{x.tag}</small></div>↗</button>)}</div></div>
</div>}
          {active === "Settings" && <div className="feature-panel"><h2>Personalize <em>KIRAVO.</em></h2><p className="sub">Choose your AI partner and language.</p><div className="settings-grid"><label>AI assistant<select value={assistant.id} onChange={(e) => { const x = assistants.find((a) => a.id === e.target.value); if (x) chooseAssistant(x); }}>{assistants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.gender}</option>)}</select></label><label>Language<select value={language} onChange={(e) => chooseLanguage(e.target.value)}>{languages.map((x) => <option key={x}>{x}</option>)}</select></label></div></div>}
        </section>
      </div>
    </main>
  );
}
