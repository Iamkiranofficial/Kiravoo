"use client";

import { useEffect, useRef, useState } from "react";

const assistants = ["ARIA", "NOVA", "LUNA", "ORION", "ATLAS", "KAEL"];

type Project = { id: string; prompt: string; url?: string; createdAt: string; aspectRatio?: string; duration?: number; model?: string; name?: string; assistant?: string; language?: string };

export default function EditorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [split, setSplit] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("kiravo-history") || "[]");
      setProjects(Array.isArray(saved) ? saved : []);
      const latest = Array.isArray(saved) && saved.length ? saved[0] : null;
      if (latest?.url) setUrl(latest.url);
    } catch {}
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    v.muted = muted;
  }, [speed, muted]);

  const loadUrl = (next: string, name = "Generated video") => {
    setUrl(next);
    setFileName(name);
    setStart(0);
    setEnd(0);
    setSplit(null);
    setPlaying(false);
  };

  const loadFile = (file?: File) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    loadUrl(objectUrl, file.name);
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (end > 0 && v.currentTime >= end) v.currentTime = start;
      await v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    if (end > 0 && v.currentTime >= end) {
      v.pause();
      v.currentTime = start;
      setPlaying(false);
    }
  };

  const setTrimStart = (value: number) => {
    const next = Math.min(value, Math.max(0, (end || duration) - 0.1));
    setStart(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  };

  const setTrimEnd = (value: number) => {
    const next = Math.max(value, Math.min(duration, start + 0.1));
    setEnd(next);
  };

  const reset = () => {
    setStart(0);
    setEnd(duration);
    setSplit(null);
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const markSplit = () => {
    const v = videoRef.current;
    if (v) setSplit(v.currentTime);
  };

  const exportVideo = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  return (
    <main className="kiravo-editor-page">
      <style>{`
        .kiravo-editor-page{min-height:100vh;background:radial-gradient(circle at 50% -10%,#3c2368 0,#120d24 38%,#06040d 80%);color:#fff;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding:28px;box-sizing:border-box}.kiravo-editor-page *{box-sizing:border-box}.editor-top{max-width:1180px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:22px;border-bottom:1px solid #ffffff14}.editor-brand{display:flex;align-items:center;gap:10px;font-weight:900;letter-spacing:.16em}.editor-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#ffffff28,#ffffff08);border:1px solid #ffffff25;box-shadow:0 12px 30px #0008}.editor-back{padding:10px 15px;border:1px solid #ffffff1c;border-radius:999px;background:#ffffff08;color:#d7cfdf;text-decoration:none;font-size:11px}.editor-main{max-width:1180px;margin:42px auto 80px}.editor-kicker{font-size:9px;letter-spacing:.24em;color:#8fefff}.editor-heading{display:flex;justify-content:space-between;gap:25px;align-items:end;margin-bottom:22px}.editor-heading h1{font:400 clamp(42px,7vw,76px)/.9 Georgia,serif;letter-spacing:-.06em;margin:10px 0}.editor-heading h1 em{font-style:italic;background:linear-gradient(90deg,#4df6ff,#9b70ff,#ff50c9);-webkit-background-clip:text;color:transparent}.editor-heading p{max-width:430px;color:#958aa2;font-size:12px;line-height:1.6}.editor-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px}.editor-card{border:1px solid #ffffff18;border-radius:24px;background:linear-gradient(145deg,#ffffff12,#ffffff04);box-shadow:0 35px 90px #000b,inset 0 1px #fff4;backdrop-filter:blur(18px);overflow:hidden}.editor-stage{position:relative;background:#030208;min-height:360px;display:grid;place-items:center}.editor-stage video{display:block;width:100%;max-height:66vh;aspect-ratio:16/9;object-fit:contain;background:#030208}.editor-empty{padding:70px 30px;text-align:center;color:#81768d}.editor-empty strong{display:block;color:#d8d0df;font-size:16px;margin-bottom:8px}.editor-caption{position:absolute;left:8%;right:8%;bottom:12%;text-align:center;font-size:clamp(20px,3vw,40px);font-weight:800;text-shadow:0 3px 20px #000}.editor-toolbar{display:flex;flex-wrap:wrap;gap:8px;padding:15px;border-top:1px solid #ffffff12}.editor-btn{border:1px solid #ffffff18;border-radius:11px;background:#ffffff07;color:#c9c0d1;padding:10px 12px;font-size:10px;cursor:pointer}.editor-btn:hover,.editor-btn.active{border-color:#62eaff66;background:#62eaff10;color:#fff}.editor-timeline{padding:18px}.editor-track{height:72px;border:1px solid #ffffff15;border-radius:15px;background:linear-gradient(90deg,#21183b,#10101d);position:relative;overflow:hidden}.editor-wave{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 8px,#67eaff22 9px 10px),linear-gradient(180deg,transparent 20%,#8b6dff20 50%,transparent 80%)}.editor-playhead{position:absolute;top:0;bottom:0;width:2px;background:#67eaff;box-shadow:0 0 12px #67eaff;transform:translateX(-1px)}.editor-split{position:absolute;top:0;bottom:0;width:2px;background:#ff6fb1;box-shadow:0 0 12px #ff6fb1}.editor-range{margin-top:12px;display:grid;gap:8px}.editor-range label{display:grid;grid-template-columns:70px 1fr 52px;align-items:center;gap:9px;color:#958ba1;font-size:10px}.editor-range input{width:100%;accent-color:#67eaff}.editor-side{padding:18px}.editor-side h3{margin:0 0 13px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a89eaf}.editor-project{width:100%;display:flex;gap:9px;align-items:center;padding:10px;margin:7px 0;border:1px solid #ffffff12;border-radius:13px;background:#ffffff06;color:#d1c7d9;text-align:left;cursor:pointer}.editor-project:hover{border-color:#62eaff55}.editor-dot{width:8px;height:8px;border-radius:50%;background:#67eaff;box-shadow:0 0 10px #67eaff;flex:none}.editor-project small{display:block;color:#7f748b;font-size:8px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.editor-control{margin-top:14px;padding:14px;border:1px solid #ffffff12;border-radius:15px;background:#ffffff05}.editor-control label{display:block;color:#8f849a;font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px}.editor-control select{width:100%;padding:10px;border:1px solid #ffffff16;border-radius:10px;background:#090711;color:#fff}.editor-note{color:#766c81;font-size:9px;line-height:1.6;margin-top:10px}.editor-export{width:100%;margin-top:14px;padding:12px;border:1px solid #fff;border-radius:12px;background:linear-gradient(135deg,#fff,#c8faff,#e1c8ff);color:#08050d;font-weight:900;font-size:10px;cursor:pointer}.editor-upload{display:block;padding:12px;border:1px dashed #ffffff25;border-radius:12px;color:#a89eaf;font-size:10px;text-align:center;cursor:pointer}.editor-upload input{display:none}@media(max-width:900px){.kiravo-editor-page{padding:16px}.editor-layout{grid-template-columns:1fr}.editor-heading{display:block}.editor-side{display:grid;grid-template-columns:1fr 1fr;gap:10px}.editor-side h3{grid-column:1/-1}.editor-control{margin-top:0}.editor-export{grid-column:1/-1}}@media(max-width:560px){.editor-heading h1{font-size:48px}.editor-side{grid-template-columns:1fr}.editor-stage{min-height:240px}.editor-toolbar{gap:6px}.editor-btn{padding:9px}.editor-range label{grid-template-columns:55px 1fr 40px}}
      `}</style>

      <header className="editor-top"><div className="editor-brand"><span className="editor-mark">K</span><span>KIRAVO</span></div><a className="editor-back" href="/">← Studio</a></header>

      <section className="editor-main">
        <div className="editor-heading"><div><div className="editor-kicker">KIRAVO WORKSPACE · EDITOR</div><h1>Shape the <em>final cut.</em></h1></div><p>Bring in a generated KIRAVO world or a local video. Preview, trim, split, caption and control the playback before exporting.</p></div>

        <div className="editor-layout">
          <div className="editor-card">
            <div className="editor-stage">
              {url ? <><video ref={videoRef} src={url} controls playsInline onLoadedMetadata={(e) => { const d=e.currentTarget.duration||0; setDuration(d); setEnd((old)=>old>0?Math.min(old,d):d); }} onTimeUpdate={onTime} /><button className="editor-caption" style={{display:captions?"block":"none",background:"none",border:0,color:"white"}} onClick={()=>setCaptions(false)}>KIRAVO</button></> : <div className="editor-empty"><strong>No clip loaded</strong><span>Choose a project or upload a video to start editing.</span></div>}
            </div>
            <div className="editor-toolbar">
              <button className="editor-btn" onClick={togglePlay}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
              <button className={`editor-btn ${muted?"active":""}`} onClick={()=>setMuted(v=>!v)}>{muted?"🔇 Muted":"🔊 Sound"}</button>
              <button className={`editor-btn ${captions?"active":""}`} onClick={()=>setCaptions(v=>!v)}>CC Captions</button>
              <button className="editor-btn" onClick={markSplit}>✂ Split at playhead</button>
              <button className="editor-btn" onClick={reset}>↺ Reset trim</button>
            </div>
            <div className="editor-timeline">
              <div className="editor-track"><div className="editor-wave"/><div className="editor-playhead" style={{left:`${duration?((videoRef.current?.currentTime||0)/duration)*100:0}%`}}/><div className="editor-split" style={{display:split!==null&&duration?"block":"none",left:`${split&&duration?(split/duration)*100:0}%`}}/></div>
              <div className="editor-range">
                <label>IN <input type="range" min="0" max={Math.max(duration,0.1)} step="0.1" value={Math.min(start,duration)} onChange={e=>setTrimStart(Number(e.target.value))}/><span>{start.toFixed(1)}s</span></label>
                <label>OUT <input type="range" min="0" max={Math.max(duration,0.1)} step="0.1" value={Math.min(end||duration,duration)} onChange={e=>setTrimEnd(Number(e.target.value))}/><span>{(end||duration).toFixed(1)}s</span></label>
              </div>
            </div>
          </div>

          <aside className="editor-card editor-side">
            <h3>Media</h3>
            <label className="editor-upload">＋ Upload video<input type="file" accept="video/*" onChange={e=>loadFile(e.target.files?.[0])}/></label>
            <div className="editor-control"><label>Playback</label><select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>
            <div className="editor-control"><label>Recent KIRAVO projects</label>{projects.length?projects.slice(0,5).map(p=><button className="editor-project" key={p.id} onClick={()=>p.url&&loadUrl(p.url,p.name||p.prompt)}><span className="editor-dot"/><div><b>{p.name||p.prompt||"Untitled world"}</b><small>{p.assistant||"KIRAVO"} · {p.duration||"—"}s · {p.model||"video"}</small></div></button>):<div className="editor-note">Generate a video in Studio and it will appear here automatically.</div>}</div>
            <div className="editor-control"><label>Current clip</label><div className="editor-note">{fileName||"Latest generated video"}<br/>{duration?`${duration.toFixed(1)} seconds":"Ready for editing"}</div></div>
            <button className="editor-export" onClick={exportVideo} disabled={!url}>Open / Export clip ↗</button>
            <div className="editor-note">Trim and split controls currently affect the preview workflow. Final encoded export will be connected to the render pipeline next.</div>
          </aside>
        </div>
      </section>
    </main>
  );
}
