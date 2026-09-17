"use client";

import { useEffect, useRef, useState } from "react";
import "../assistant-chat.css";

type Message = { role: "user" | "assistant"; content: string };
type LiveSocket = WebSocket | null;

const assistants = [
  { id: "aria", name: "ARIA", tag: "Visionary", orb: "◈", voice: "Aoede" },
  { id: "nova", name: "NOVA", tag: "Energetic", orb: "✦", voice: "Kore" },
  { id: "luna", name: "LUNA", tag: "Storyteller", orb: "☾", voice: "Aoede" },
  { id: "orion", name: "ORION", tag: "Precision", orb: "◎", voice: "Charon" },
  { id: "atlas", name: "ATLAS", tag: "Explorer", orb: "◇", voice: "Puck" },
  { id: "kael", name: "KAEL", tag: "Editor", orb: "△", voice: "Charon" },
];

const languageMap: Record<string, string> = {
  "Auto-detect": "en-IN", English: "en-IN", "తెలుగు": "te-IN", "हिन्दी": "hi-IN",
  "தமிழ்": "ta-IN", "ಕನ್ನಡ": "kn-IN", "മലയാളം": "ml-IN", "বাংলা": "bn-IN",
  "मराठी": "mr-IN", "ગુજરાતી": "gu-IN", "ਪੰਜਾਬੀ": "pa-IN", "اردو": "ur-IN",
  "Español": "es-ES", "Français": "fr-FR", Deutsch: "de-DE", "Português": "pt-BR",
  "日本語": "ja-JP", "한국어": "ko-KR", "中文": "zh-CN", "العربية": "ar-SA",
};

const createVideoTool = {
  name: "create_video",
  description: "Create a KIRAVO AI video from the user's idea. Use this when the user explicitly asks you to create, generate, make, render, or produce a video. Do not call it for questions or brainstorming only.",
  parameters: {
    type: "OBJECT",
    properties: {
      prompt: { type: "STRING", description: "Detailed visual description of the video to create." },
      model: { type: "STRING", enum: ["ltx-2.3", "wan-2.2"], description: "Video model. Prefer ltx-2.3 unless the user asks for Wan." },
      aspectRatio: { type: "STRING", enum: ["16:9", "9:16", "1:1"], description: "Video aspect ratio." },
      style: { type: "STRING", enum: ["Cinematic", "Realistic", "Anime", "Commercial", "Dreamy"], description: "Visual style." },
      duration: { type: "INTEGER", description: "Duration in seconds. LTX supports 1-30 seconds; Wan supports 3-15 seconds." },
      audio: { type: "BOOLEAN", description: "Whether to generate audio. Only supported by LTX 2.3." },
    },
    required: ["prompt"],
  },
};

const downsampleTo16k = (input: Float32Array, inputRate: number) => {
  const outputRate = 16000;
  if (inputRate === outputRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
    return out;
  }
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
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
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
};

const base64ToInt16 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
};

export default function AssistantChat() {
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

  const socketRef = useRef<LiveSocket>(null);
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
    socketRef.current?.close();
    socketRef.current = null;
    cleanupAudio();
    stopPlayback();
    setLive(false);
    setConnecting(false);
  };

  const systemInstruction = () => {
    const languageInstruction = language === "Auto-detect"
      ? "Detect the user's language and reply naturally in that language."
      : `Reply naturally in ${language}.`;
    const personality =
      assistant === "aria" ? "Be bold, cinematic, imaginative and decisive." :
      assistant === "nova" ? "Be playful, experimental, fast and inventive." :
      assistant === "luna" ? "Focus on emotion, narrative, atmosphere and human feeling." :
      assistant === "orion" ? "Be structured, practical, technical and production-minded." :
      assistant === "atlas" ? "Be curious, research-minded, strategic and excellent at world-building." :
      "Focus on pacing, polish, clarity and final-quality execution.";
    return `${current.name} is KIRAVO's ${current.tag} creative partner. ${personality} You operate the KIRAVO creative studio. When the user explicitly asks to create or generate a video, use the create_video tool instead of merely explaining how to do it. Ask a short clarification only when a required creative detail is genuinely ambiguous. ${languageInstruction} Keep spoken answers natural and reasonably concise. This is a real-time voice conversation, so do not use long lists unless the user asks.`;
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

  const executeToolCall = async (call: any) => {
    if (call?.name !== "create_video") {
      return { ok: false, error: `Unknown KIRAVO tool: ${call?.name || "unknown"}` };
    }

    const args = call.args || {};
    const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
    if (!prompt) return { ok: false, error: "A video prompt is required." };

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: args.model || "ltx-2.3",
          aspectRatio: args.aspectRatio || "16:9",
          style: args.style || "Cinematic",
          duration: Number.isInteger(args.duration) ? args.duration : 5,
          audio: args.audio === true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, error: data.error || "KIRAVO could not start the video render." };
      return { ok: true, message: "Video generation started.", jobId: data.id, status: data.status, settings: data };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Video generation failed." };
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
      const tokenResponse = await fetch("/api/live/token", { method: "POST" });
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

      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenData.token)}`
      );
      socketRef.current = ws;

      let setupComplete = false;
      const connectionTimeout = window.setTimeout(() => {
        if (!setupComplete) {
          setVoiceError("Gemini Live setup timed out. Try the microphone again.");
          try { ws.close(); } catch {}
        }
      }, 12000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: `models/${tokenData.model || "gemini-3.8-live"}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: current.voice } } },
            },
            systemInstruction: { parts: [{ text: systemInstruction() }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: [createVideoTool] }],
          },
        }));
      };

      ws.onmessage = async (event) => {
        let response: any;
        try { response = JSON.parse(event.data); } catch { return; }

        if (response?.error) {
          clearTimeout(connectionTimeout);
          setVoiceError(response.error.message || "Gemini Live returned an error.");
          return;
        }

        if (response?.setupComplete) {
          setupComplete = true;
          clearTimeout(connectionTimeout);
          setLive(true);
          setConnecting(false);
          return;
        }

        if (response?.toolCall?.functionCalls?.length) {
          for (const call of response.toolCall.functionCalls) {
            const result = await executeToolCall(call);
            ws.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  name: call.name,
                  id: call.id,
                  response: { result },
                }],
              },
            }));
          }
          return;
        }

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

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        setVoiceError("Gemini Live connection failed. Try again; if it persists, check the Gemini API key in Vercel.");
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        cleanupAudio();
        socketRef.current = null;
        setLive(false);
        setConnecting(false);
        if (event.code !== 1000 && event.code !== 1001) setVoiceError(event.reason || `Gemini Live disconnected (code ${event.code}).`);
      };

      const source = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const samples = downsampleTo16k(event.inputBuffer.getChannelData(0), inputContext.sampleRate);
        ws.send(JSON.stringify({ realtimeInput: { audio: { data: int16ToBase64(samples), mimeType: "audio/pcm;rate=16000" } } }));
      };

      const silentGain = inputContext.createGain();
      silentGain.gain.value = 0;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputContext.destination);
    } catch (error) {
      cleanupAudio();
      socketRef.current?.close();
      socketRef.current = null;
      setConnecting(false);
      setLive(false);
      setVoiceError(error instanceof Error ? error.message : "Could not start live voice.");
    }
  };

  const toggleLive = () => {
    if (live || connecting) stopLive();
    else connectLive();
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((items) => [...items, { role: "user", content: text }]);

    if (live && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } }));
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
          {Object.keys(languageMap).map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>

      <div className="assistant-chat-messages">
        {messages.length === 0 && <div className="assistant-chat-welcome">
          <span>{current.orb}</span>
          <h3>Hey, I’m {current.name}.</h3>
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
