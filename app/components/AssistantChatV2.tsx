"use client";

import { GoogleGenAI, Modality } from "@google/genai";
import { useEffect, useRef, useState } from "react";
import "../assistant-chat.css";

type Message = { role: "user" | "assistant"; content: string };

type LiveSession = any;

const assistants = [
  { id: "aria", name: "ARIA", tag: "Visionary", orb: "◈", voice: "Aoede" },
  { id: "nova", name: "NOVA", tag: "Energetic", orb: "✦", voice: "Kore" },
  { id: "luna", name: "LUNA", tag: "Storyteller", orb: "☾", voice: "Aoede" },
  { id: "orion", name: "ORION", tag: "Precision", orb: "◎", voice: "Charon" },
  { id: "atlas", name: "ATLAS", tag: "Explorer", orb: "◇", voice: "Puck" },
  { id: "kael", name: "KAEL", tag: "Editor", orb: "△", voice: "Charon" },
];

const languages: Record<string, string> = {
  "Auto-detect": "Auto-detect", English: "English", "తెలుగు": "Telugu", "हिन्दी": "Hindi",
  "தமிழ்": "Tamil", "ಕನ್ನಡ": "Kannada", "മലയാളം": "Malayalam", "বাংলা": "Bengali",
  "मराठी": "Marathi", "ગુજરાતી": "Gujarati", "ਪੰਜਾਬੀ": "Punjabi", "اردو": "Urdu",
  "Español": "Spanish", "Français": "French", Deutsch: "German", "Português": "Portuguese",
  "日本語": "Japanese", "한국어": "Korean", "中文": "Chinese", "العربية": "Arabic",
};

const downsampleTo16k = (input: Float32Array, inputRate: number) => {
  const outputRate = 16000;
  if (inputRate === outputRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
    return out;
  }
  const ratio = inputRate / outputRate;
  const output = new Int16Array(Math.round(input.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) { sum += input[j]; count++; }
    const sample = count ? sum / count : 0;
    output[i] = Math.max(-1, Math.min(1, sample)) * 32767;
  }
  return output;
};

const int16ToBase64 = (samples: Int16Array) => {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return btoa(binary);
};

const base64ToInt16 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
};

export default function AssistantChatV2() {
  const [open, setOpen] = useState(false);
  const [assistant, setAssistant] = useState("aria");
  const [language, setLanguage] = useState("Auto-detect");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const sessionRef = useRef<LiveSession>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveAssistantTextRef = useRef("");

  useEffect(() => {
    try {
      setAssistant(localStorage.getItem("kiravo-assistant") || "aria");
      setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect");
    } catch {}
    return () => stopLive();
  }, []);

  const current = assistants.find((x) => x.id === assistant) || assistants[0];

  const stopPlayback = () => {
    sourcesRef.current.forEach((source) => { try { source.stop(); } catch {} });
    sourcesRef.current.clear();
    if (outputContextRef.current) nextPlayTimeRef.current = outputContextRef.current.currentTime;
    setSpeaking(false);
  };

  const playPcm24 = async (base64: string) => {
    const context = outputContextRef.current || new AudioContext({ sampleRate: 24000 });
    outputContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    const samples = base64ToInt16(base64);
    const buffer = context.createBuffer(1, samples.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const start = Math.max(nextPlayTimeRef.current, context.currentTime + 0.01);
    nextPlayTimeRef.current = start + buffer.duration;
    sourcesRef.current.add(source);
    setSpeaking(true);
    source.onended = () => {
      sourcesRef.current.delete(source);
      if (!sourcesRef.current.size) setSpeaking(false);
    };
    source.start(start);
  };

  const cleanupAudio = () => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (inputContextRef.current) {
      inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }
  };

  const stopLive = () => {
    try { sessionRef.current?.close(); } catch {}
    sessionRef.current = null;
    cleanupAudio();
    stopPlayback();
    setLive(false);
    setConnecting(false);
  };

  const systemInstruction = () => {
    const languageInstruction = language === "Auto-detect"
      ? "Detect the user's language and reply naturally in that language."
      : `Reply naturally in ${languages[language] || language}.`;
    const personality =
      assistant === "aria" ? "Be bold, cinematic, imaginative and decisive." :
      assistant === "nova" ? "Be playful, experimental, fast and inventive." :
      assistant === "luna" ? "Focus on emotion, narrative, atmosphere and human feeling." :
      assistant === "orion" ? "Be structured, practical, technical and production-minded." :
      assistant === "atlas" ? "Be curious, research-minded, strategic and excellent at world-building." :
      "Focus on pacing, polish, clarity and final-quality execution.";
    return `${current.name} is KIRAVO's ${current.tag} creative partner. ${personality} You have access to KIRAVO's video, image, voice, writing, design, editing, research and technical capabilities. ${languageInstruction} Keep spoken answers natural and reasonably concise. This is a real-time voice conversation, so do not use long lists unless the user asks.`;
  };

  const addAssistantTranscript = (text: string) => {
    if (!text) return;
    const previous = liveAssistantTextRef.current;
    liveAssistantTextRef.current += text;
    const full = liveAssistantTextRef.current;
    setMessages((items) => {
      const last = items[items.length - 1];
      if (last?.role === "assistant" && last.content === previous) {
        return [...items.slice(0, -1), { role: "assistant", content: full }];
      }
      return [...items, { role: "assistant", content: full }];
    });
  };

  const handleLiveMessage = async (response: any) => {
    const content = response?.serverContent;
    if (!content) return;
    if (content.interrupted) stopPlayback();
    if (content.interimInputTranscription?.text) setInput(content.interimInputTranscription.text);
    if (content.inputTranscription?.text) {
      const text = content.inputTranscription.text.trim();
      if (text) {
        setMessages((items) => [...items, { role: "user", content: text }]);
        setInput("");
      }
    }
    if (content.outputTranscription?.text) addAssistantTranscript(content.outputTranscription.text);
    for (const part of content.modelTurn?.parts || []) {
      if (part?.inlineData?.data && String(part.inlineData.mimeType || "").startsWith("audio/pcm")) {
        await playPcm24(part.inlineData.data);
      }
    }
    if (content.turnComplete) {
      liveAssistantTextRef.current = "";
      setInput("");
    }
  };

  const connectLive = async () => {
    if (live || connecting) return;
    setVoiceError("");
    if (!window.isSecureContext) {
      setVoiceError("Live voice requires HTTPS. Open KIRAVO from kiravoo.vercel.app.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("This browser does not provide microphone access.");
      return;
    }

    setConnecting(true);
    try {
      const tokenResponse = await fetch("/api/live/token", { method: "POST", cache: "no-store" });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.token) throw new Error(tokenData.error || "Gemini Live is not connected.");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error("This browser does not support live audio.");
      const inputContext = new AudioCtx();
      inputContextRef.current = inputContext;
      const outputContext = outputContextRef.current || new AudioContext({ sampleRate: 24000 });
      outputContextRef.current = outputContext;
      await inputContext.resume();
      await outputContext.resume();

      const ai = new GoogleGenAI({ apiKey: tokenData.token });
      const session = await ai.live.connect({
        model: tokenData.model || "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: current.voice } } },
          systemInstruction: { parts: [{ text: systemInstruction() }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: any) => { void handleLiveMessage(message); },
          onerror: (event: any) => {
            setVoiceError(event?.message || event?.error?.message || "Gemini Live connection failed.");
            setConnecting(false);
            setLive(false);
          },
          onclose: (event: any) => {
            cleanupAudio();
            sessionRef.current = null;
            setLive(false);
            setConnecting(false);
            if (event?.reason) setVoiceError(event.reason);
          },
        },
      });
      sessionRef.current = session;
      setLive(true);
      setConnecting(false);

      const source = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return;
        const samples = downsampleTo16k(event.inputBuffer.getChannelData(0), inputContext.sampleRate);
        sessionRef.current.sendRealtimeInput({
          audio: { data: int16ToBase64(samples), mimeType: "audio/pcm;rate=16000" },
        });
      };
      const silentGain = inputContext.createGain();
      silentGain.gain.value = 0;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputContext.destination);
    } catch (error) {
      cleanupAudio();
      try { sessionRef.current?.close(); } catch {}
      sessionRef.current = null;
      setConnecting(false);
      setLive(false);
      setVoiceError(error instanceof Error ? error.message : "Could not start live voice.");
    }
  };

  const toggleLive = () => live || connecting ? stopLive() : void connectLive();

  const sendText = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((items) => [...items, { role: "user", content: text }]);
    if (live && sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text });
      return;
    }
    setBusy(true);
    try {
      const next = [...messages, { role: "user" as const, content: text }];
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant, language, messages: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Assistant is unavailable right now.");
      setMessages((items) => [...items, { role: "assistant", content: data.text || "I'm ready. What should we create?" }]);
    } catch (error) {
      setMessages((items) => [...items, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  };

  return <div className="kiravo-assistant-chat">
    {open && <section className="assistant-chat-panel" aria-label="KIRAVO AI assistant">
      <header className="assistant-chat-header">
        <div className="assistant-chat-identity">
          <span className={`assistant-chat-orb ${live ? "voice-active" : speaking ? "voice-speaking" : ""}`}>{current.orb}</span>
          <div><strong>{current.name}</strong><small>{connecting ? "Connecting live…" : live ? "Live voice · speak naturally" : `${current.tag} · voice ready`}</small></div>
        </div>
        <button onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="assistant-chat-tools">
        <select value={assistant} onChange={(e) => { setAssistant(e.target.value); localStorage.setItem("kiravo-assistant", e.target.value); }}>
          {assistants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.tag}</option>)}
        </select>
        <select value={language} onChange={(e) => { setLanguage(e.target.value); localStorage.setItem("kiravo-language", e.target.value); }}>
          {Object.keys(languages).map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="assistant-chat-messages">
        {messages.length === 0 && <div className="assistant-chat-welcome">
          <span>{current.orb}</span><h3>Hey, I’m {current.name}.</h3>
          <p>Tap the microphone and talk naturally. KIRAVO will listen, respond, and speak back.</p>
          <button className="voice-start" onClick={toggleLive}>🎙 Start voice conversation</button>
        </div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`assistant-message ${message.role}`}>{message.content}</div>)}
        {busy && <div className="assistant-message assistant typing">Thinking…</div>}
      </div>
      {voiceError && <div className="assistant-voice-error">{voiceError}</div>}
      <div className="assistant-chat-input">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} placeholder={live ? `Talk to ${current.name}…` : `Message ${current.name}…`} rows={1} disabled={busy} />
        <button className={`mic-button ${live ? "active" : ""}`} onClick={toggleLive} disabled={busy} aria-label={live ? "Stop live conversation" : "Start live conversation"}>{live ? "■" : "🎙"}</button>
        <button onClick={sendText} disabled={!input.trim() || busy}>↑</button>
      </div>
    </section>}
    <button className="assistant-chat-launcher" onClick={() => setOpen((value) => !value)}><span>{current.orb}</span><b>{open ? "Close" : "AI"}</b></button>
  </div>;
}
