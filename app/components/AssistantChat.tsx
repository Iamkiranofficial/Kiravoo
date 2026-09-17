"use client";

import { useEffect, useRef, useState } from "react";
import "../assistant-chat.css";

type Message = { role: "user" | "assistant"; content: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const assistants = [
  { id: "aria", name: "ARIA", tag: "Visionary", orb: "◈" },
  { id: "nova", name: "NOVA", tag: "Energetic", orb: "✦" },
  { id: "luna", name: "LUNA", tag: "Storyteller", orb: "☾" },
  { id: "orion", name: "ORION", tag: "Precision", orb: "◎" },
  { id: "atlas", name: "ATLAS", tag: "Explorer", orb: "◇" },
  { id: "kael", name: "KAEL", tag: "Editor", orb: "△" },
];

const languageMap: Record<string, string> = {
  "Auto-detect": "en-IN", English: "en-IN", "తెలుగు": "te-IN", "हिन्दी": "hi-IN", "தமிழ்": "ta-IN", "ಕನ್ನಡ": "kn-IN", "മലയാളം": "ml-IN", "বাংলা": "bn-IN", "मराठी": "mr-IN", "ગુજરાતી": "gu-IN", "ਪੰਜਾਬੀ": "pa-IN", "اردو": "ur-IN", "Español": "es-ES", "Français": "fr-FR", Deutsch: "de-DE", "Português": "pt-BR", "日本語": "ja-JP", "한국어": "ko-KR", "中文": "zh-CN", "العربية": "ar-SA"
};

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [assistant, setAssistant] = useState("aria");
  const [language, setLanguage] = useState("Auto-detect");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    try {
      setAssistant(localStorage.getItem("kiravo-assistant") || "aria");
      setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect");
    } catch {}
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const current = assistants.find((x) => x.id === assistant) || assistants[0];

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageMap[language] || "en-IN";
    utterance.rate = 1.02;
    utterance.pitch = assistant === "aria" || assistant === "nova" || assistant === "luna" ? 1.05 : 0.92;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant, language, messages: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Assistant is unavailable right now.");
      const reply = data.text || "I'm ready. What should we create?";
      setMessages((items) => [...items, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "Something went wrong.";
      setMessages((items) => [...items, { role: "assistant", content: reply }]);
      speak(reply);
    } finally {
      setBusy(false);
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages((items) => [...items, { role: "assistant", content: "Voice input is not supported in this browser. Try Chrome on Android or desktop." }]);
      return;
    }
    window.speechSynthesis?.cancel();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = languageMap[language] || "en-IN";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript);
      const last = event.results[event.results.length - 1];
      if (last?.isFinal) send(transcript);
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognition.onerror = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="kiravo-assistant-chat">
      {open && (
        <section className="assistant-chat-panel" aria-label="KIRAVO AI assistant">
          <header className="assistant-chat-header">
            <div className="assistant-chat-identity">
              <span className={`assistant-chat-orb ${listening ? "voice-active" : speaking ? "voice-speaking" : ""}`}>{current.orb}</span>
              <div><strong>{current.name}</strong><small>{listening ? "Listening…" : speaking ? "Speaking…" : `${current.tag} · voice ready`}</small></div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
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
            {messages.length === 0 && <div className="assistant-chat-welcome"><span>{current.orb}</span><h3>Hey, I’m {current.name}.</h3><p>Tap the microphone and talk naturally. KIRAVO will listen, respond, and speak back.</p><button className="voice-start" onClick={toggleListening}>🎙 Start voice conversation</button></div>}
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`assistant-message ${message.role}`}>{message.content}</div>)}
            {busy && <div className="assistant-message assistant typing">Thinking…</div>}
          </div>

          <div className="assistant-chat-input">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Talk to ${current.name}…`} rows={1} disabled={busy} />
            <button className={`mic-button ${listening ? "active" : ""}`} onClick={toggleListening} disabled={busy} aria-label={listening ? "Stop listening" : "Start voice input"}>{listening ? "■" : "🎙"}</button>
            <button onClick={() => send()} disabled={!input.trim() || busy} aria-label="Send message">↑</button>
          </div>
        </section>
      )}
      <button className="assistant-chat-launcher" onClick={() => setOpen((x) => !x)} aria-label="Open KIRAVO AI assistant">
        <span>{current.orb}</span><b>{open ? "Close" : "AI"}</b>
      </button>
    </div>
  );
}
