"use client";

import { useEffect, useState } from "react";
import "../assistant-chat.css";

type Message = { role: "user" | "assistant"; content: string };

const assistants = [
  { id: "aria", name: "ARIA", tag: "Visionary", orb: "◈" },
  { id: "nova", name: "NOVA", tag: "Energetic", orb: "✦" },
  { id: "luna", name: "LUNA", tag: "Storyteller", orb: "☾" },
  { id: "orion", name: "ORION", tag: "Precision", orb: "◎" },
  { id: "atlas", name: "ATLAS", tag: "Explorer", orb: "◇" },
  { id: "kael", name: "KAEL", tag: "Editor", orb: "△" },
];

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [assistant, setAssistant] = useState("aria");
  const [language, setLanguage] = useState("Auto-detect");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setAssistant(localStorage.getItem("kiravo-assistant") || "aria");
      setLanguage(localStorage.getItem("kiravo-language") || "Auto-detect");
    } catch {}
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (button?.textContent?.trim() === "Editor") window.location.href = "/editor";
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const current = assistants.find((x) => x.id === assistant) || assistants[0];

  const send = async () => {
    const text = input.trim();
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
      setMessages((items) => [...items, { role: "assistant", content: data.text || "I'm ready. What should we create?" }]);
    } catch (error) {
      setMessages((items) => [...items, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kiravo-assistant-chat">
      {open && (
        <section className="assistant-chat-panel" aria-label="KIRAVO AI assistant">
          <header className="assistant-chat-header">
            <div className="assistant-chat-identity">
              <span className="assistant-chat-orb">{current.orb}</span>
              <div><strong>{current.name}</strong><small>{current.tag} · all capabilities</small></div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
          </header>

          <div className="assistant-chat-tools">
            <select value={assistant} onChange={(e) => { setAssistant(e.target.value); localStorage.setItem("kiravo-assistant", e.target.value); }}>
              {assistants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.tag}</option>)}
            </select>
            <select value={language} onChange={(e) => { setLanguage(e.target.value); localStorage.setItem("kiravo-language", e.target.value); }}>
              {['Auto-detect','English','తెలుగు','हिन्दी','தமிழ்','ಕನ್ನಡ','മലയാളം','বাংলা','मराठी','ગુજરાતી','ਪੰਜਾਬੀ','اردو','Español','Français','Deutsch','Português','日本語','한국어','中文','العربية'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="assistant-chat-messages">
            {messages.length === 0 && <div className="assistant-chat-welcome"><span>{current.orb}</span><h3>Hey, I’m {current.name}.</h3><p>Ask me anything. I can help with video, image, voice, writing, design, editing, research or tech.</p></div>}
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`assistant-message ${message.role}`}>{message.content}</div>)}
            {busy && <div className="assistant-message assistant typing">Thinking…</div>}
          </div>

          <div className="assistant-chat-input">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Talk to ${current.name}…`} rows={1} disabled={busy} />
            <button onClick={send} disabled={!input.trim() || busy} aria-label="Send message">↑</button>
          </div>
        </section>
      )}
      <button className="assistant-chat-launcher" onClick={() => setOpen((x) => !x)} aria-label="Open KIRAVO AI assistant">
        <span>{current.orb}</span><b>{open ? "Close" : "AI"}</b>
      </button>
    </div>
  );
}
