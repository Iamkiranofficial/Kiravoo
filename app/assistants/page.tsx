"use client";

import { useMemo, useState } from "react";

const assistants = [
  { id: "aria", name: "ARIA", gender: "Female", symbol: "✦", tone: "Elegant · Creative · Confident", description: "A polished creative partner for ideas, stories, visuals and ambitious concepts." },
  { id: "nova", name: "NOVA", gender: "Female", symbol: "◈", tone: "Energetic · Bold · Curious", description: "Fast-moving creative energy for experiments, content and visual worlds." },
  { id: "luna", name: "LUNA", gender: "Female", symbol: "☾", tone: "Warm · Imaginative · Calm", description: "A thoughtful companion for storytelling, mood, emotion and detailed direction." },
  { id: "orion", name: "ORION", gender: "Male", symbol: "◇", tone: "Focused · Strategic · Precise", description: "A confident all-purpose partner for planning, production and problem solving." },
  { id: "atlas", name: "ATLAS", gender: "Male", symbol: "⬡", tone: "Analytical · Curious · Direct", description: "A broad-thinking assistant for research, ideas, technical work and creation." },
  { id: "kael", name: "KAEL", gender: "Male", symbol: "⚡", tone: "Sharp · Modern · Inventive", description: "A hands-on partner for editing, building, coding and turning ideas into action." },
];

const languages = ["Auto-detect", "English", "తెలుగు", "हिन्दी", "தமிழ்", "ಕನ್ನಡ", "മലയാളം", "বাংলা", "मराठी", "ગુજરાતી", "ਪੰਜਾਬੀ", "اردو", "Español", "Français", "Deutsch", "Português", "日本語", "한국어", "中文", "العربية", "Русский"];
const capabilities = ["Create", "Video", "Image", "Voice", "Story", "Director", "Editor", "Research", "Code", "Translate"];

export default function AssistantsPage() {
  const [selected, setSelected] = useState("aria");
  const [language, setLanguage] = useState("Auto-detect");
  const [query, setQuery] = useState("");
  const assistant = assistants.find((x) => x.id === selected) || assistants[0];
  const filtered = useMemo(() => assistants.filter((x) => `${x.name} ${x.gender} ${x.tone}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <main className="hub">
      <div className="stars" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <header className="topbar">
        <a className="brand" href="/">K<span>IRAVO</span></a>
        <div className="hub-title"><small>AI COMPANION SYSTEM</small><b>Choose your intelligence.</b></div>
        <a className="back" href="/">← Studio</a>
      </header>

      <section className="intro">
        <div><span className="eyebrow">6 PERSONALITIES · ONE KIRAVO BRAIN</span><h1>Meet your <em>AI.</em></h1><p>Choose who you want to create with. Every assistant can do everything in KIRAVO and every assistant understands the same multilingual workspace.</p></div>
        <div className="language"><label>Conversation language</label><select value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((x) => <option key={x}>{x}</option>)}</select><small>All six assistants share the same language intelligence.</small></div>
      </section>

      <div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an assistant…"/></div>

      <section className="grid">
        {filtered.map((x, index) => <button key={x.id} className={`assistant ${selected === x.id ? "selected" : ""}`} onClick={() => setSelected(x.id)}>
          <span className="number">0{index + 1}</span><span className="avatar">{x.symbol}</span><span className="gender">{x.gender}</span><strong>{x.name}</strong><small>{x.tone}</small><p>{x.description}</p><span className="select">{selected === x.id ? "SELECTED" : "SELECT"} ↗</span>
        </button>)}
      </section>

      <section className="active-card">
        <div className="active-avatar">{assistant.symbol}</div><div className="active-copy"><span className="eyebrow">YOUR SELECTED ASSISTANT</span><h2>{assistant.name}</h2><p>{assistant.description}</p><div className="capabilities">{capabilities.map((x) => <span key={x}>{x}</span>)}</div></div>
        <div className="active-controls"><label>Language<select value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((x) => <option key={x}>{x}</option>)}</select></label><a href="/" className="launch">Start with {assistant.name} ↗</a></div>
      </section>

      <p className="principle"><b>One assistant can do it all.</b> The personality changes. Your capabilities, projects, language and tools stay with you.</p>
      <style jsx>{`
        *{box-sizing:border-box}.hub{min-height:100vh;background:radial-gradient(circle at 50% -10%,#172039 0,#070914 42%,#03040a 100%);color:#f5f7ff;padding:0 5vw 70px;font-family:Arial,sans-serif;position:relative;overflow:hidden}.stars i{position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;opacity:.35}.stars i:nth-child(1){top:18%;left:8%}.stars i:nth-child(2){top:28%;right:12%}.stars i:nth-child(3){top:64%;left:18%}.stars i:nth-child(4){top:72%;right:24%}.stars i:nth-child(5){top:12%;right:35%}.topbar{height:86px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff12;position:relative;z-index:2}.brand{font-weight:900;letter-spacing:.18em;font-size:18px;color:#fff;text-decoration:none}.brand span{opacity:.55}.hub-title{display:flex;flex-direction:column;text-align:center;gap:5px}.hub-title small,.eyebrow{font-size:10px;letter-spacing:.18em;color:#8d98b5}.hub-title b{font-size:13px}.back{color:#aab3c9;text-decoration:none;font-size:12px}.intro{max-width:1200px;margin:75px auto 30px;display:grid;grid-template-columns:1.5fr .7fr;gap:50px;align-items:end}.intro h1{font-size:clamp(52px,8vw,105px);line-height:.9;margin:16px 0}.intro em{font-style:normal;color:#8ca8ff}.intro p{max-width:720px;color:#9da6bc;line-height:1.7;font-size:15px}.language{background:#ffffff08;border:1px solid #ffffff12;border-radius:22px;padding:22px}.language label,.active-controls label{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8d98b5;margin-bottom:9px}.language select,.active-controls select,.search input{width:100%;background:#0b0e19;color:#fff;border:1px solid #ffffff18;border-radius:12px;padding:13px;outline:none}.language small{display:block;color:#707991;margin-top:10px;font-size:11px}.search{max-width:1200px;margin:25px auto 18px;display:flex;align-items:center;gap:12px;background:#ffffff07;border:1px solid #ffffff12;border-radius:15px;padding:0 16px}.search span{font-size:20px;color:#8791a9}.search input{border:0;background:transparent}.grid{max-width:1200px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.assistant{position:relative;text-align:left;min-height:265px;padding:27px;border-radius:25px;border:1px solid #ffffff12;background:linear-gradient(145deg,#ffffff0b,#ffffff03);color:#fff;cursor:pointer;transition:.25s;overflow:hidden}.assistant:hover,.assistant.selected{transform:translateY(-5px);border-color:#9bb0ff66;box-shadow:0 18px 60px #0008}.assistant.selected:after{content:"";position:absolute;inset:auto -30px -70px;width:180px;height:180px;background:#8ca8ff22;filter:blur(30px);border-radius:50%}.number{position:absolute;top:18px;right:20px;color:#5e667c;font-size:10px}.avatar,.active-avatar{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:linear-gradient(145deg,#293451,#0c1020);border:1px solid #ffffff1c;font-size:25px;box-shadow:inset 0 1px #fff2}.gender{display:block;color:#7f8aa4;font-size:9px;letter-spacing:.16em;text-transform:uppercase;margin-top:24px}.assistant strong{display:block;font-size:29px;letter-spacing:.08em;margin-top:5px}.assistant>small{display:block;color:#a0a9bd;margin-top:4px}.assistant p{color:#788299;font-size:12px;line-height:1.5;max-width:280px}.select{position:absolute;bottom:22px;right:23px;font-size:9px;letter-spacing:.14em;color:#94a7ff}.active-card{max-width:1200px;margin:30px auto 0;padding:28px;display:grid;grid-template-columns:auto 1fr 230px;gap:24px;align-items:center;border:1px solid #9aafff2b;background:linear-gradient(110deg,#a2b7ff0c,#ffffff04);border-radius:28px}.active-avatar{width:78px;height:78px;font-size:32px}.active-copy h2{font-size:36px;margin:8px 0}.active-copy p{color:#929cb1;font-size:13px;margin:0 0 14px}.capabilities{display:flex;flex-wrap:wrap;gap:7px}.capabilities span{padding:6px 9px;border:1px solid #ffffff12;border-radius:99px;color:#a7afc1;font-size:9px}.active-controls label{margin-bottom:14px}.launch{display:block;text-align:center;background:#f5f7ff;color:#080a12;text-decoration:none;font-weight:800;padding:13px;border-radius:12px;font-size:11px}.principle{text-align:center;color:#646d82;font-size:11px;margin:28px auto 0}.principle b{color:#aab4cb}@media(max-width:800px){.hub{padding:0 18px 50px}.topbar{height:70px}.hub-title{display:none}.intro{grid-template-columns:1fr;margin-top:45px}.grid{grid-template-columns:1fr}.assistant{min-height:220px}.active-card{grid-template-columns:auto 1fr}.active-controls{grid-column:1/-1}.active-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end}.intro h1{font-size:60px}}@media(max-width:480px){.active-card{grid-template-columns:1fr}.active-avatar{width:64px;height:64px}.active-controls{grid-template-columns:1fr}.language{padding:17px}.intro{gap:20px}}
      `}</style>
    </main>
  );
}
