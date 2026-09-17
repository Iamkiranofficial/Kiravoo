"use client";

import { useEffect, useRef, useState } from "react";
import "../assistant-chat.css";

type Message = { role: "user" | "assistant"; content: string };

const assistants = [
  { id: "aria", name: "ARIA", tag: "Visionary", orb: "◈", voice: "Aoede" },
  { id: "nova", name: "NOVA", tag: "Energetic", orb: "✦", voice: "Kore" },
  { id: "luna", name: "LUNA", tag: "Storyteller", orb: "☾", voice: "Aoede" },
  { id: "orion", name: "ORION", tag: "Precision", orb: "◎", voice: "Charon" },
  { id: "atlas", name: "ATLAS", tag: "Explorer", orb: "◇", voice: "Puck" },
  { id: "kael", name: "KAEL", tag: "Editor", orb: "△", voice: "Charon" },
];
const languages = ["Auto-detect", "English", "తెలుగు", "हिन्दी", "தமிழ்", "ಕನ್ನಡ", "മലയാളം", "বাংলা", "मराठी", "ગુજરાતી", "ਪੰਜਾਬੀ", "اردو", "Español", "Français", "Deutsch", "Português", "日本語", "한국어", "中文", "العربية"];

function downsample(input: Float32Array, rate: number) {
  const ratio = rate / 16000, out = new Int16Array(Math.round(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0; for (let j = start; j < end; j++) sum += input[j];
    const v = end > start ? sum / (end - start) : 0;
    out[i] = Math.max(-1, Math.min(1, v)) * 32767;
  }
  return out;
}
function pcmB64(samples: Int16Array) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  return btoa(s);
}
function b64Pcm(value: string) {
  const s = atob(value), bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export default function AssistantChatAgent() {
  const [open, setOpen] = useState(false), [assistant, setAssistant] = useState("aria"), [language, setLanguage] = useState("Auto-detect");
  const [input, setInput] = useState(""), [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false), [connecting, setConnecting] = useState(false), [speaking, setSpeaking] = useState(false), [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null), streamRef = useRef<MediaStream | null>(null), inCtxRef = useRef<AudioContext | null>(null), procRef = useRef<ScriptProcessorNode | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null), playAt = useRef(0), sources = useRef(new Set<AudioBufferSourceNode>()), transcript = useRef("");

  const current = assistants.find(a => a.id === assistant) || assistants[0];

  useEffect(() => {
    try { setAssistant(localStorage.getItem("kiravo-assistant") || "aria"); setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect"); } catch {}
    return () => stop();
  }, []);

  function stopAudio() {
    sources.current.forEach(s => { try { s.stop(); } catch {} }); sources.current.clear();
    if (outCtxRef.current) playAt.current = outCtxRef.current.currentTime;
    setSpeaking(false);
  }
  function cleanup() {
    procRef.current?.disconnect(); procRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    inCtxRef.current?.close().catch(() => {}); inCtxRef.current = null;
  }
  function stop() {
    wsRef.current?.close(); wsRef.current = null; cleanup(); stopAudio(); setLive(false); setConnecting(false);
  }
  async function play(base64: string) {
    const ctx = outCtxRef.current || new AudioContext({ sampleRate: 24000 }); outCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const samples = b64Pcm(base64), buffer = ctx.createBuffer(1, samples.length, 24000), ch = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
    const start = Math.max(playAt.current, ctx.currentTime + 0.01); playAt.current = start + buffer.duration;
    sources.current.add(source); setSpeaking(true); source.onended = () => { sources.current.delete(source); if (!sources.current.size) setSpeaking(false); }; source.start(start);
  }
  function addAssistant(text: string) {
    if (!text) return; const old = transcript.current; transcript.current += text; const full = transcript.current;
    setMessages(items => { const last = items[items.length - 1]; return last?.role === "assistant" && last.content === old ? [...items.slice(0, -1), { role: "assistant", content: full }] : [...items, { role: "assistant", content: full }]; });
  }
  function instruction() {
    const lang = language === "Auto-detect" ? "Detect the user's language and answer in that language." : `Answer in ${language}.`;
    return `${current.name} is KIRAVO's ${current.tag} creative partner. You can operate KIRAVO's creative studio. If the user asks to create or generate a video, call create_video rather than merely explaining. Use sensible defaults for omitted options. After successful tool execution, briefly confirm the render was started. ${lang} Keep spoken replies concise and natural.`;
  }
  async function createVideo(args: any) {
    const payload = {
      prompt: String(args?.prompt || "").trim(), model: args?.model === "wan-2.2" ? "wan-2.2" : "ltx-2.3",
      aspectRatio: ["16:9", "9:16", "1:1"].includes(args?.aspectRatio) ? args.aspectRatio : "16:9",
      style: ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"].includes(args?.style) ? args.style : "Cinematic",
      duration: Number(args?.duration || 5), audio: args?.audio === true,
    };
    if (!payload.prompt) throw new Error("Please give me a video idea first.");
    const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.id) throw new Error(data.error || "KIRAVO could not start the render.");
    try {
      const history = JSON.parse(localStorage.getItem("kiravo-history") || "[]");
      localStorage.setItem("kiravo-history", JSON.stringify([{ id: data.id, prompt: payload.prompt, createdAt: new Date().toISOString(), aspectRatio: payload.aspectRatio, style: payload.style, duration: payload.duration, model: payload.model, assistant, language }, ...history].slice(0, 20)));
    } catch {}
    return { status: "queued", renderId: data.id, message: "KIRAVO video generation has started." };
  }
  async function handleTool(response: any, ws: WebSocket) {
    const calls = response?.toolCall?.functionCalls || [], functionResponses = [];
    for (const call of calls) {
      try {
        const result = call.name === "create_video" ? await createVideo(call.args) : (() => { throw new Error(`Unknown tool: ${call.name}`); })();
        functionResponses.push({ id: call.id, name: call.name, response: { result } });
      } catch (e) { functionResponses.push({ id: call.id, name: call.name, response: { error: e instanceof Error ? e.message : "Tool failed." } }); }
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
  }
  async function connect() {
    if (live || connecting) return; setError(""); setConnecting(true);
    try {
      const tokenR = await fetch("/api/live/token", { method: "POST" }), token = await tokenR.json();
      if (!tokenR.ok || !token.token) throw new Error(token.error || "Gemini Live is unavailable.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); streamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext; if (!Ctx) throw new Error("Live audio is not supported in this browser.");
      const inputCtx = new Ctx(); inCtxRef.current = inputCtx; outCtxRef.current ||= new AudioContext({ sampleRate: 24000 }); await inputCtx.resume(); await outCtxRef.current.resume();
      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token.token)}`); wsRef.current = ws;
      let ready = false; const timeout = window.setTimeout(() => { if (!ready) { setError("Gemini Live setup timed out. Try again."); try { ws.close(); } catch {} } }, 12000);
      ws.onopen = () => ws.send(JSON.stringify({ setup: {
        model: `models/${token.model || "gemini-3.8-live"}`,
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: current.voice } } } },
        systemInstruction: { parts: [{ text: instruction() }] }, inputAudioTranscription: {}, outputAudioTranscription: {},
        tools: [{ functionDeclarations: [{ name: "create_video", description: "Start a KIRAVO text-to-video render when the user asks you to create a video.", behavior: "BLOCKING", parameters: { type: "OBJECT", properties: {
          prompt: { type: "STRING", description: "Detailed visual description of the video." }, model: { type: "STRING", enum: ["ltx-2.3", "wan-2.2"] }, aspectRatio: { type: "STRING", enum: ["16:9", "9:16", "1:1"] }, style: { type: "STRING", enum: ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"] }, duration: { type: "NUMBER" }, audio: { type: "BOOLEAN" }
        }, required: ["prompt"] } }] }]
      } }));
      ws.onmessage = async event => {
        let msg: any; try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.error) { clearTimeout(timeout); setError(msg.error.message || "Gemini Live error."); return; }
        if (msg.setupComplete) { ready = true; clearTimeout(timeout); setLive(true); setConnecting(false); return; }
        if (msg.toolCall) { await handleTool(msg, ws); return; }
        const c = msg.serverContent; if (!c) return;
        if (c.interrupted) stopAudio(); if (c.interimInputTranscription?.text) setInput(c.interimInputTranscription.text);
        if (c.inputTranscription?.text?.trim()) { setMessages(items => [...items, { role: "user", content: c.inputTranscription.text.trim() }]); setInput(""); }
        if (c.outputTranscription?.text) addAssistant(c.outputTranscription.text);
        for (const part of c.modelTurn?.parts || []) if (part?.inlineData?.data && String(part.inlineData.mimeType || "").startsWith("audio/pcm")) await play(part.inlineData.data);
        if (c.turnComplete) transcript.current = "";
      };
      ws.onerror = () => { clearTimeout(timeout); setError("Gemini Live connection failed."); };
      ws.onclose = e => { clearTimeout(timeout); cleanup(); wsRef.current = null; setLive(false); setConnecting(false); if (![1000, 1001].includes(e.code)) setError(e.reason || `Gemini Live disconnected (${e.code}).`); };
      const source = inputCtx.createMediaStreamSource(stream), proc = inputCtx.createScriptProcessor(4096, 1, 1), gain = inputCtx.createGain(); procRef.current = proc; gain.gain.value = 0;
      proc.onaudioprocess = e => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ realtimeInput: { audio: { data: pcmB64(downsample(e.inputBuffer.getChannelData(0), inputCtx.sampleRate)), mimeType: "audio/pcm;rate=16000" } } })); };
      source.connect(proc); proc.connect(gain); gain.connect(inputCtx.destination);
    } catch (e) { cleanup(); wsRef.current?.close(); wsRef.current = null; setConnecting(false); setLive(false); setError(e instanceof Error ? e.message : "Could not start live voice."); }
  }
  async function sendText() {
    const text = input.trim(); if (!text) return; setInput(""); setMessages(items => [...items, { role: "user", content: text }]);
    if (live && wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } })); return; }
    setBusy(true); try { const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assistant, language, messages: [...messages, { role: "user", content: text }] }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Assistant unavailable."); setMessages(items => [...items, { role: "assistant", content: d.text || "I'm ready." }]); } catch (e) { setMessages(items => [...items, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]); } finally { setBusy(false); }
  }

  return <div className="kiravo-assistant-chat">
    {open && <section className="assistant-chat-panel" aria-label="KIRAVO AI assistant">
      <header className="assistant-chat-header"><div className="assistant-chat-identity"><span className={`assistant-chat-orb ${live ? "voice-active" : speaking ? "voice-speaking" : ""}`}>{current.orb}</span><div><strong>{current.name}</strong><small>{connecting ? "Connecting live…" : live ? "Live voice · speak naturally" : `${current.tag} · voice ready`}</small></div></div><button onClick={() => setOpen(false)}>×</button></header>
      <div className="assistant-chat-tools"><select value={assistant} onChange={e => { setAssistant(e.target.value); localStorage.setItem("kiravo-assistant", e.target.value); }}><option value="aria">ARIA · Visionary</option><option value="nova">NOVA · Energetic</option><option value="luna">LUNA · Storyteller</option><option value="orion">ORION · Precision</option><option value="atlas">ATLAS · Explorer</option><option value="kael">KAEL · Editor</option></select><select value={language} onChange={e => { setLanguage(e.target.value); localStorage.setItem("kiravo-language", e.target.value); }}>{languages.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="assistant-chat-messages">{messages.length === 0 && <div className="assistant-chat-welcome"><span>{current.orb}</span><h3>Hey, I’m {current.name}.</h3><p>Tell me what you want to create. I can now operate KIRAVO for you.</p><button className="voice-start" onClick={() => connect()}>🎙 Start voice conversation</button></div>}{messages.map((m,i) => <div key={`${m.role}-${i}`} className={`assistant-message ${m.role}`}>{m.content}</div>)}{busy && <div className="assistant-message assistant typing">Thinking…</div>}</div>
      {error && <div className="assistant-voice-error">{error}</div>}
      <div className="assistant-chat-input"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} placeholder={live ? `Talk to ${current.name}…` : `Message ${current.name}…`} rows={1} disabled={busy}/><button className={`mic-button ${live ? "active" : ""}`} onClick={() => live || connecting ? stop() : connect()} disabled={busy}>{live ? "■" : "🎙"}</button><button onClick={sendText} disabled={!input.trim() || busy}>↑</button></div>
    </section>}
    <button className="assistant-chat-launcher" onClick={() => setOpen(v => !v)}><span>{current.orb}</span><b>{open ? "Close" : "AI"}</b></button>
  </div>;
}
