"use client";

import { useEffect, useRef, useState } from "react";
import "../assistant-chat.css";

type Message = { role: "user" | "assistant"; content: string };
type WS = WebSocket;
type RenderJob = {
  id: string;
  prompt: string;
  status: string;
  url?: string;
  error?: string;
  createdAt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
};

const assistants = [
  { id: "aria", name: "ARIA", tag: "Visionary", orb: "◈" },
  { id: "nova", name: "NOVA", tag: "Energetic", orb: "✦" },
  { id: "luna", name: "LUNA", tag: "Storyteller", orb: "☾" },
  { id: "orion", name: "ORION", tag: "Precision", orb: "◎" },
  { id: "atlas", name: "ATLAS", tag: "Explorer", orb: "◇" },
  { id: "kael", name: "KAEL", tag: "Editor", orb: "△" },
];
const languages = ["Auto-detect", "English", "తెలుగు", "हिन्दी", "தமிழ்", "ಕನ್ನಡ", "മലയാളം", "বাংলা", "मराठी", "ગુજરાતી", "ਪੰਜਾਬੀ", "اردو", "Español", "Français", "Deutsch", "Português", "日本語", "한국어", "中文", "العربية"];

function downsample(input: Float32Array, rate: number) {
  const ratio = rate / 16000;
  const out = new Int16Array(Math.max(1, Math.round(input.length / ratio)));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const v = end > start ? sum / (end - start) : 0;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return out;
}
function pcmB64(samples: Int16Array) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  return btoa(s);
}
function b64Pcm(value: string) {
  const s = atob(value);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export default function AssistantChatAgentDirect() {
  const [open, setOpen] = useState(false);
  const [assistant, setAssistant] = useState("aria");
  const [language, setLanguage] = useState("Auto-detect");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);

  const wsRef = useRef<WS | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const playAt = useRef(0);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const transcript = useRef("");
  const setupDone = useRef(false);

  const current = assistants.find(a => a.id === assistant) || assistants[0];

  useEffect(() => {
    try {
      setAssistant(localStorage.getItem("kiravo-assistant") || "aria");
      setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect");
      const saved = JSON.parse(localStorage.getItem("kiravo-render-jobs") || "[]");
      if (Array.isArray(saved)) setRenderJobs(saved);
    } catch {}
    return () => stop();
  }, []);

  useEffect(() => {
    try { localStorage.setItem("kiravo-render-jobs", JSON.stringify(renderJobs)); } catch {}
  }, [renderJobs]);

  useEffect(() => {
    if (!renderJobs.some(job => ["queued", "processing", "generating"].includes(job.status))) return;
    const timer = window.setInterval(async () => {
      for (const job of renderJobs) {
        if (!["queued", "processing", "generating"].includes(job.status)) continue;
        try {
          const r = await fetch("/api/generate/status?id=" + encodeURIComponent(job.id), { cache: "no-store" });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) continue;
          setRenderJobs(current => current.map(item => item.id === job.id
            ? { ...item, status: d.status || item.status, url: d.url || item.url, error: d.error || item.error }
            : item
          ));
        } catch {}
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [renderJobs]);

  function stopAudio() {
    sources.current.forEach(s => { try { s.stop(); } catch {} });
    sources.current.clear();
    if (outCtxRef.current) playAt.current = outCtxRef.current.currentTime;
    setSpeaking(false);
  }

  function cleanup() {
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    inCtxRef.current?.close().catch(() => {});
    inCtxRef.current = null;
    setupDone.current = false;
  }

  function stop() {
    try { wsRef.current?.close(1000, "KIRAVO stopped"); } catch {}
    wsRef.current = null;
    cleanup();
    stopAudio();
    setLive(false);
    setConnecting(false);
  }

  async function play(base64: string) {
    const ctx = outCtxRef.current || new AudioContext({ sampleRate: 24000 });
    outCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const samples = b64Pcm(base64);
    const buffer = ctx.createBuffer(1, samples.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const start = Math.max(playAt.current, ctx.currentTime + 0.01);
    playAt.current = start + buffer.duration;
    sources.current.add(source);
    setSpeaking(true);
    source.onended = () => {
      sources.current.delete(source);
      if (!sources.current.size) setSpeaking(false);
    };
    source.start(start);
  }

  function addAssistant(text: string) {
    if (!text) return;
    const old = transcript.current;
    transcript.current += text;
    const full = transcript.current;
    setMessages(items => {
      const last = items[items.length - 1];
      return last?.role === "assistant" && last.content === old
        ? [...items.slice(0, -1), { role: "assistant", content: full }]
        : [...items, { role: "assistant", content: full }];
    });
  }

  function instruction() {
    const lang = language === "Auto-detect" ? "Detect the user's language and answer in that language." : `Answer in ${language}.`;
    return `${current.name} is KIRAVO's ${current.tag} creative partner. You can operate KIRAVO's creative studio. If the user asks to create or generate a video, call create_video rather than merely explaining. Use sensible defaults for omitted options. After successful tool execution, briefly confirm the render was started. ${lang} Keep spoken replies concise and natural.`;
  }

  async function createVideo(args: any) {
    const payload = {
      prompt: String(args?.prompt || "").trim(),
      model: args?.model === "wan-2.2" ? "wan-2.2" : "ltx-2.3",
      aspectRatio: ["16:9", "9:16", "1:1"].includes(args?.aspectRatio) ? args.aspectRatio : "16:9",
      style: ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"].includes(args?.style) ? args.style : "Cinematic",
      duration: Number(args?.duration || 5),
      audio: args?.audio === true,
    };
    if (!payload.prompt) throw new Error("Please give me a video idea first.");
    const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.id) throw new Error(data.error || "KIRAVO could not start the render.");
    const job: RenderJob = {
      id: data.id,
      prompt: payload.prompt,
      status: data.status || "queued",
      createdAt: new Date().toISOString(),
      model: payload.model,
      duration: payload.duration,
      aspectRatio: payload.aspectRatio,
    };
    setRenderJobs(items => [job, ...items.filter(item => item.id !== job.id)].slice(0, 20));
    return { status: "queued", renderId: data.id, message: "Video generation started. The render is now visible in Dashboard.", dashboardUrl: "/dashboard" };
  }

  async function handleTool(msg: any, ws: WS) {
    const calls = msg?.toolCall?.functionCalls || [];
    const functionResponses = [];
    for (const call of calls) {
      try {
        const result = call.name === "create_video" ? await createVideo(call.args) : (() => { throw new Error(`Unknown tool: ${call.name}`); })();
        functionResponses.push({ id: call.id, name: call.name, response: { result } });
      } catch (e) {
        functionResponses.push({ id: call.id, name: call.name, response: { error: e instanceof Error ? e.message : "Tool failed." } });
      }
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
  }

  async function connect() {
    if (live || connecting) return;
    setError("");
    setConnecting(true);
    try {
      const tokenR = await fetch("/api/live/token", { method: "POST", cache: "no-store" });
      const token = await tokenR.json().catch(() => ({}));
      if (!tokenR.ok || !token.token) throw new Error(token.error || "Gemini Live token could not be created.");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) throw new Error("Live audio is not supported in this browser.");
      const inputCtx = new Ctx();
      inCtxRef.current = inputCtx;
      outCtxRef.current ||= new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume();
      await outCtxRef.current.resume();

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token.token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      const timeout = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN || !setupDone.current) {
          try { ws.close(); } catch {}
          setConnecting(false);
          setLive(false);
          setError("Gemini Live setup timed out. The WebSocket did not complete setup.");
        }
      }, 12000);

      ws.onopen = () => {
        const setup = {
          setup: {
            model: `models/${token.model || "gemini-3.8-live"}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: { parts: [{ text: instruction() }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: [{
              name: "create_video",
              description: "Start a KIRAVO text-to-video render when the user asks you to create a video.",
              parameters: {
                type: "OBJECT",
                properties: {
                  prompt: { type: "STRING", description: "Detailed visual description of the video." },
                  model: { type: "STRING", enum: ["ltx-2.3", "wan-2.2"] },
                  aspectRatio: { type: "STRING", enum: ["16:9", "9:16", "1:1"] },
                  style: { type: "STRING", enum: ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"] },
                  duration: { type: "NUMBER" },
                  audio: { type: "BOOLEAN" }
                },
                required: ["prompt"]
              }
            }] }]
          }
        };
        ws.send(JSON.stringify(setup));
      };

      ws.onmessage = async event => {
        let msg: any;
        try { msg = JSON.parse(typeof event.data === "string" ? event.data : await event.data.text()); } catch { return; }

        if (msg?.setupComplete) {
          window.clearTimeout(timeout);
          setupDone.current = true;
          setLive(true);
          setConnecting(false);
          return;
        }
        if (msg?.toolCall) {
          await handleTool(msg, ws);
          return;
        }
        if (msg?.error) {
          window.clearTimeout(timeout);
          const detail = msg.error.message || msg.error.status || JSON.stringify(msg.error);
          setConnecting(false);
          setLive(false);
          setError(`Gemini Live error: ${detail}`);
          return;
        }
        const c = msg?.serverContent;
        if (!c) return;
        if (c.interrupted) stopAudio();
        if (c.interimInputTranscription?.text) setInput(c.interimInputTranscription.text);
        if (c.inputTranscription?.text?.trim()) {
          setMessages(items => [...items, { role: "user", content: c.inputTranscription.text.trim() }]);
          setInput("");
        }
        if (c.outputTranscription?.text) addAssistant(c.outputTranscription.text);
        for (const part of c.modelTurn?.parts || []) {
          if (part?.inlineData?.data && String(part.inlineData.mimeType || "").startsWith("audio/pcm")) await play(part.inlineData.data);
        }
        if (c.turnComplete) transcript.current = "";
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        setConnecting(false);
        setLive(false);
        setError("Gemini Live WebSocket connection failed. Check the Gemini API configuration in Vercel.");
      };

      ws.onclose = event => {
        window.clearTimeout(timeout);
        if (wsRef.current === ws) wsRef.current = null;
        cleanup();
        setConnecting(false);
        setLive(false);
        if (!setupDone.current && event.code !== 1000) setError(`Gemini Live closed the connection (${event.code}${event.reason ? `: ${event.reason}` : ""}).`);
      };

      const source = inputCtx.createMediaStreamSource(stream);
      const proc = inputCtx.createScriptProcessor(2048, 1, 1);
      const gain = inputCtx.createGain();
      procRef.current = proc;
      gain.gain.value = 0;
      proc.onaudioprocess = e => {
        if (ws.readyState !== WebSocket.OPEN || !setupDone.current) return;
        try {
          const data = pcmB64(downsample(e.inputBuffer.getChannelData(0), inputCtx.sampleRate));
          ws.send(JSON.stringify({ realtimeInput: { audio: { data, mimeType: "audio/pcm;rate=16000" } } }));
        } catch {}
      };
      source.connect(proc);
      proc.connect(gain);
      gain.connect(inputCtx.destination);
    } catch (e) {
      cleanup();
      wsRef.current = null;
      setConnecting(false);
      setLive(false);
      setError(e instanceof Error ? e.message : "Could not start Gemini Live.");
    }
  }

  async function sendText() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages(items => [...items, { role: "user", content: text }]);
    if (live && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ realtimeInput: { text } }));
      return;
    }

    const wantsVideo = /\b(create|generate|make|render|produce|animate)\b[\s\S]*\bvideo\b|\bvideo\b[\s\S]*\b(create|generate|make|render|produce|animate)\b/i.test(text);
    if (wantsVideo) {
      setBusy(true);
      try {
        const result = await createVideo({ prompt: text });
        setMessages(items => [...items, { role: "assistant", content: "Done — your video render has started. I’ve added it to the Render Dashboard so you can watch the progress there." }]);
      } catch (e) {
        setMessages(items => [...items, { role: "assistant", content: e instanceof Error ? e.message : "I couldn't start the video render." }]);
      } finally { setBusy(false); }
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assistant, language, messages: [...messages, { role: "user", content: text }] }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Assistant unavailable.");
      setMessages(items => [...items, { role: "assistant", content: d.text || "I'm ready." }]);
    } catch (e) {
      setMessages(items => [...items, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally { setBusy(false); }
  }

  return <div className="kiravo-assistant-chat">
    {open && <section className="assistant-chat-panel" aria-label="KIRAVO AI assistant">
      <header className="assistant-chat-header"><div className="assistant-chat-identity"><span className={`assistant-chat-orb ${live ? "voice-active" : speaking ? "voice-speaking" : ""}`}>{current.orb}</span><div><strong>{current.name}</strong><small>{connecting ? "Connecting live…" : live ? "Live voice · speak naturally" : `${current.tag} · voice ready`}</small></div></div><button onClick={() => setOpen(false)}>×</button></header>
      <div className="assistant-chat-tools"><select value={assistant} onChange={e => { setAssistant(e.target.value); localStorage.setItem("kiravo-assistant", e.target.value); }}><option value="aria">ARIA · Visionary</option><option value="nova">NOVA · Energetic</option><option value="luna">LUNA · Storyteller</option><option value="orion">ORION · Precision</option><option value="atlas">ATLAS · Explorer</option><option value="kael">KAEL · Editor</option></select><select value={language} onChange={e => { setLanguage(e.target.value); localStorage.setItem("kiravo-language", e.target.value); }}>{languages.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="assistant-chat-messages">{messages.length === 0 && <div className="assistant-chat-welcome"><span>{current.orb}</span><h3>Hey, I’m {current.name}.</h3><p>Tell me what you want to create. I can now operate KIRAVO for you.</p><button className="voice-start" onClick={connect}>🎙 Start voice conversation</button></div>}{messages.map((m,i) => <div key={`${m.role}-${i}`} className={`assistant-message ${m.role}`}>{m.content}</div>)}{busy && <div className="assistant-message assistant typing">Thinking…</div>}</div>
      {error && <div className="assistant-voice-error">{error}</div>}
      {renderJobs.length > 0 && <div className="assistant-render-panel">
        <div className="assistant-render-head">
          <div><span>RENDER QUEUE</span><b>{renderJobs.filter(x => ["queued","processing","generating"].includes(x.status)).length} active</b></div>
          <a href="/dashboard">Open Dashboard ↗</a>
        </div>
        {renderJobs.slice(0, 3).map(job => <article className="assistant-render-card" key={job.id}>
          <div className="assistant-render-thumb">{job.url ? <video src={job.url} muted playsInline preload="metadata" /> : <span className="render-spinner">◌</span>}</div>
          <div className="assistant-render-copy"><strong>{job.status === "complete" ? "Render ready" : job.status === "error" ? "Render failed" : "Rendering…"}</strong><p>{job.prompt}</p><small>{job.model || "Video"} · {job.duration || 5}s</small></div>
          {job.url && <a href={job.url} target="_blank" rel="noreferrer">Open ↗</a>}
        </article>)}
      </div>}
      <div className="assistant-chat-input"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} placeholder={live ? `Talk to ${current.name}…` : `Message ${current.name}…`} rows={1} disabled={busy}/><button className={`mic-button ${live ? "active" : ""}`} onClick={() => live || connecting ? stop() : connect()} disabled={busy}>{live ? "■" : "🎙"}</button><button onClick={sendText} disabled={!input.trim() || busy}>↑</button></div>
    </section>}
    <button className="assistant-chat-launcher" onClick={() => setOpen(v => !v)}><span>{current.orb}</span><b>{open ? "Close" : "AI"}</b></button>
  </div>;
}
