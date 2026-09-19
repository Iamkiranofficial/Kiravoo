"use client";

import { useEffect, useState } from "react";

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

export default function DashboardPage() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("kiravo-render-jobs") || "[]");
      setJobs(Array.isArray(saved) ? saved : []);
    } catch { setJobs([]); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const current = (() => {
        try { return JSON.parse(localStorage.getItem("kiravo-render-jobs") || "[]"); } catch { return []; }
      }) as RenderJob[];
      if (!current.length) return;
      setRefreshing(true);
      let changed = false;
      const next = await Promise.all(current.map(async (job) => {
        if (!["queued","processing","generating"].includes(job.status)) return job;
        try {
          const r = await fetch("/api/generate/status?id=" + encodeURIComponent(job.id), { cache: "no-store" });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) return job;
          const updated = { ...job, status: d.status || job.status, url: d.url || job.url, error: d.error || job.error };
          if (updated.status !== job.status || updated.url !== job.url || updated.error !== job.error) changed = true;
          return updated;
        } catch { return job; }
      }));
      if (changed) {
        localStorage.setItem("kiravo-render-jobs", JSON.stringify(next));
        setJobs(next);
      }
      setRefreshing(false);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const active = jobs.filter(j => ["queued","processing","generating"].includes(j.status));
  const completed = jobs.filter(j => j.status === "complete" && j.url);

  return <main className="dashboard">
    <style>{styles}</style>
    <header className="top">
      <a className="brand" href="/"><span>K</span>KIRAVO</a>
      <div className="top-actions"><span className="engine"><i /> RENDER ENGINE ONLINE</span><a href="/">← Studio</a></div>
    </header>

    <section className="hero">
      <div>
        <span className="kicker">KIRAVO CONTROL CENTER</span>
        <h1>Render <em>Dashboard.</em></h1>
        <p>Every render started by your AI assistant appears here. Track progress, preview finished videos and open the final file.</p>
      </div>
      <div className="stats">
        <div><b>{active.length}</b><span>Rendering</span></div>
        <div><b>{completed.length}</b><span>Ready</span></div>
        <div><b>{jobs.length}</b><span>Total</span></div>
      </div>
    </section>

    {jobs.length === 0 ? <section className="empty">
      <div className="empty-icon">✦</div>
      <h2>No renders yet</h2>
      <p>Ask KIRAVO's assistant to create a video and the live render will appear here automatically.</p>
      <a href="/">Create a video ↗</a>
    </section> : <section className="content">
      <div className="section-head"><div><span className="kicker">LIVE QUEUE</span><h2>Rendering now</h2></div><button onClick={load}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>
      {active.length === 0 ? <div className="quiet">No active renders right now.</div> : <div className="render-list">{active.map(job => <article className="render-card" key={job.id}>
        <div className="render-preview"><div className="loader"><span>K</span></div><b>{job.status === "queued" ? "QUEUED" : "RENDERING"}</b></div>
        <div className="render-info"><div className="meta"><span>{job.model || "Video"}</span><span>{job.aspectRatio || "16:9"}</span><span>{job.duration || 5}s</span></div><h3>{job.prompt}</h3><p>AI engine is processing your cinematic render. This page checks automatically every 3 seconds.</p><div className="progress"><i /></div></div>
      </article>)}</div>}

      <div className="section-head ready-head"><div><span className="kicker">YOUR OUTPUTS</span><h2>Rendered videos</h2></div></div>
      {completed.length === 0 ? <div className="quiet">Completed renders will appear here with a playable preview.</div> : <div className="video-grid">{completed.map(job => <article className="video-card" key={job.id}>
        <div className="video-wrap"><video src={job.url} controls playsInline preload="metadata" /></div>
        <div className="video-body"><span className="ready">READY · {job.model || "VIDEO"}</span><h3>{job.prompt}</h3><p>{job.duration || 5}s · {job.aspectRatio || "16:9"}</p><div className="actions"><a href={job.url} target="_blank" rel="noreferrer">Open ↗</a><a href={job.url} download>Download ↓</a></div></div>
      </article>)}</div>}
    </section>}
  </main>;
}

const styles = `
*{box-sizing:border-box}.dashboard{min-height:100vh;background:radial-gradient(circle at 50% -10%,#392064 0,#110b20 40%,#05040b 82%);color:#fff;font-family:Inter,system-ui,sans-serif;padding:28px 28px 110px}.top{max-width:1240px;margin:auto;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff12;padding-bottom:18px}.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:950;letter-spacing:.16em}.brand span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#ffffff10;border:1px solid #ffffff18}.top-actions{display:flex;align-items:center;gap:12px}.top-actions a{color:#ddd4e5;text-decoration:none;border:1px solid #ffffff18;background:#ffffff08;border-radius:999px;padding:9px 14px;font-size:10px}.engine{font-size:8px;letter-spacing:.15em;color:#8e8296}.engine i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#63f6c4;box-shadow:0 0 14px #63f6c4;margin-right:6px}.hero{max-width:1240px;margin:60px auto 38px;display:flex;justify-content:space-between;align-items:end;gap:30px}.kicker{font-size:9px;letter-spacing:.24em;color:#78efff}.hero h1{font:400 clamp(48px,7vw,82px)/.9 Georgia,serif;letter-spacing:-.06em;margin:12px 0}.hero h1 em{font-style:italic;background:linear-gradient(90deg,#55f5ff,#9c70ff,#ff58c9);-webkit-background-clip:text;color:transparent}.hero p{max-width:600px;color:#958a9f;font-size:13px;line-height:1.7}.stats{display:flex;border:1px solid #ffffff14;border-radius:20px;background:#ffffff07;padding:8px}.stats div{min-width:90px;padding:12px 15px;text-align:center}.stats b{display:block;font-size:25px}.stats span{display:block;margin-top:4px;color:#857a8e;font-size:8px;letter-spacing:.1em;text-transform:uppercase}.content{max-width:1240px;margin:auto}.section-head{display:flex;align-items:end;justify-content:space-between;margin:35px 0 15px}.section-head h2{margin:7px 0 0;font:400 32px Georgia,serif}.section-head button{border:1px solid #ffffff18;background:#ffffff08;color:#fff;border-radius:10px;padding:9px 13px;cursor:pointer;font-size:10px}.render-list{display:grid;gap:14px}.render-card{display:grid;grid-template-columns:220px 1fr;border:1px solid #ffffff16;border-radius:20px;background:#ffffff07;overflow:hidden}.render-preview{min-height:180px;background:radial-gradient(circle,#241936,#07060b);display:grid;place-items:center;position:relative}.render-preview>b{position:absolute;top:12px;left:12px;font-size:8px;letter-spacing:.15em;color:#72f0ff}.loader{width:64px;height:64px;border:1px solid #ffffff20;border-radius:20px;display:grid;place-items:center;animation:pulse 1.6s ease-in-out infinite}.loader span{font:700 28px Georgia;color:#fff}.render-info{padding:22px}.meta{display:flex;gap:7px;flex-wrap:wrap}.meta span{font-size:8px;color:#aaa0af;border:1px solid #ffffff12;background:#ffffff06;border-radius:999px;padding:5px 8px}.render-info h3{font-size:16px;line-height:1.4;margin:14px 0 7px}.render-info p{color:#80758b;font-size:10px}.progress{height:4px;background:#ffffff0c;border-radius:99px;overflow:hidden;margin-top:22px}.progress i{display:block;height:100%;width:45%;background:linear-gradient(90deg,#55f5ff,#9c70ff,#ff58c9);animation:move 1.8s ease-in-out infinite}.quiet{border:1px dashed #ffffff18;border-radius:18px;padding:35px;text-align:center;color:#786d83;font-size:11px}.ready-head{margin-top:55px}.video-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.video-card{border:1px solid #ffffff16;border-radius:20px;background:#ffffff07;overflow:hidden}.video-wrap{aspect-ratio:16/9;background:#000}.video-wrap video{width:100%;height:100%;object-fit:cover}.video-body{padding:17px}.ready{font-size:8px;letter-spacing:.15em;color:#68f0bf}.video-body h3{font-size:14px;line-height:1.45;margin:8px 0}.video-body p{font-size:9px;color:#82778e}.actions{display:flex;gap:8px;margin-top:13px}.actions a{color:#08050d;background:#fff;border-radius:9px;padding:9px 12px;text-decoration:none;font-size:9px;font-weight:900}.actions a+ a{color:#fff;background:#ffffff0a;border:1px solid #ffffff16}.empty{max-width:760px;margin:70px auto;border:1px dashed #ffffff20;border-radius:28px;text-align:center;padding:70px 30px}.empty-icon{font-size:38px;margin-bottom:15px;color:#79efff}.empty h2{font:400 30px Georgia,serif;margin:0 0 8px}.empty p{color:#887d92;font-size:12px;line-height:1.6}.empty a{display:inline-block;margin-top:16px;color:#08050d;background:#fff;padding:11px 17px;border-radius:10px;text-decoration:none;font-size:10px;font-weight:900}@keyframes pulse{0%,100%{transform:scale(.95);opacity:.55}50%{transform:scale(1.05);opacity:1}}@keyframes move{0%{transform:translateX(-100%)}100%{transform:translateX(240%)}}@media(max-width:800px){.dashboard{padding:18px 15px 100px}.hero{display:block;margin-top:40px}.stats{margin-top:25px;width:100%}.stats div{flex:1;min-width:0}.render-card{grid-template-columns:1fr}.render-preview{min-height:150px}.video-grid{grid-template-columns:1fr}.top-actions .engine{display:none}}
`;
`;
