"use client";

import { useEffect, useState } from "react";

function decodeProject(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(decodeURIComponent(atob(raw))); } catch { return null; }
}

export default function SharePage() {
  const [project, setProject] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("p");
    setProject(decodeProject(raw));
    setChecked(true);
  }, []);

  const remix = () => {
    if (!project) return;
    localStorage.setItem("kiravo-remix-prompt", project.prompt || "");
    localStorage.setItem("kiravo-remix-style", project.style || "Cinematic");
    localStorage.setItem("kiravo-remix-ratio", project.aspectRatio || "16:9");
    window.location.href = "/";
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch {}
  };

  if (!checked) return <main className="share-page"><div className="share-card"><div className="share-logo">K</div><h1>Loading world…</h1><p>Opening the shared KIRAVO creation.</p></div><style>{styles}</style></main>;

  if (!project) return <main className="share-page"><div className="share-card"><div className="share-logo">K</div><h1>World not found.</h1><p>This share link is missing or invalid.</p><a href="/">← Back to KIRAVO</a></div><style>{styles}</style></main>;

  return <main className="share-page"><style>{styles}</style><div className="share-shell"><header><div className="brand"><span>K</span>KIRAVO</div><a href="/">Create with KIRAVO →</a></header><section className="share-hero"><div className="kicker">KIRAVO · SHARED WORLD</div><h1>{project.name || project.prompt || "Untitled world"}</h1><div className="media">{project.url ? <video src={project.url} controls playsInline autoPlay muted/> : <div className="no-media">✦</div>}</div><div className="info"><p>{project.prompt || "A KIRAVO creation."}</p><div className="tags"><span>{project.assistant || "KIRAVO"}</span><span>{project.language || "Auto"}</span><span>{project.aspectRatio || "16:9"}</span><span>{project.style || "Cinematic"}</span></div><div className="actions"><button className="primary" onClick={remix}>↻ Remix this world</button><button onClick={copy}>⌁ Copy share link</button><button onClick={()=>project.url&&window.open(project.url,"_blank","noopener,noreferrer")}>↗ Open video</button></div></div></section></div></main>;
}

const styles = `.share-page{min-height:100vh;background:radial-gradient(circle at 50% -10%,#3d226c 0,#100a1d 42%,#05040a 84%);color:#fff;font-family:Inter,system-ui,sans-serif;padding:24px}.share-shell{max-width:1000px;margin:auto}.share-shell header{display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid #ffffff14}.brand{display:flex;gap:10px;align-items:center;font-weight:900;letter-spacing:.16em}.brand span,.share-logo{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#ffffff12;border:1px solid #ffffff20}.share-shell header a{color:#d9d0e0;text-decoration:none;font-size:10px;border:1px solid #ffffff18;padding:10px 14px;border-radius:999px}.share-hero{max-width:760px;margin:55px auto}.kicker{font-size:9px;letter-spacing:.25em;color:#78efff}.share-hero h1{font:400 clamp(40px,7vw,72px)/.95 Georgia,serif;letter-spacing:-.05em;margin:12px 0 24px}.media{border:1px solid #ffffff18;border-radius:24px;overflow:hidden;background:#030208;box-shadow:0 35px 100px #000b}.media video{display:block;width:100%;max-height:70vh;object-fit:contain}.no-media{height:400px;display:grid;place-items:center;font-size:80px;color:#76668d}.info{padding:18px 2px}.info p{color:#958a9f;font-size:12px;line-height:1.6}.tags{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}.tags span{font-size:8px;padding:6px 9px;border:1px solid #ffffff12;background:#ffffff08;border-radius:999px;color:#aaa0b1}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{border:1px solid #ffffff18;background:#ffffff08;color:#ddd5e2;border-radius:11px;padding:11px 14px;font-size:10px;cursor:pointer}.actions .primary{background:#fff;color:#08050d;border-color:#fff;font-weight:900}.share-card{max-width:500px;margin:15vh auto;text-align:center;border:1px solid #ffffff18;background:#ffffff08;border-radius:24px;padding:45px}.share-card h1{font:400 45px Georgia,serif}.share-card p{color:#8f849a;font-size:12px}.share-card a{display:inline-block;margin-top:15px;color:#fff;text-decoration:none;border:1px solid #ffffff18;border-radius:10px;padding:10px 14px;font-size:10px}@media(max-width:600px){.share-page{padding:16px}.share-shell header a{font-size:9px}.share-hero{margin:35px auto}.no-media{height:260px}}`;