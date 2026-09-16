"use client";

export default function CreatorNav() {
  return (
    <a href="/creator" aria-label="Open creator profile" className="creator-nav">
      <span>◉</span>
      <b>Profile</b>
      <style jsx>{`
        .creator-nav{position:fixed;right:18px;bottom:18px;z-index:40;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(10,7,18,.82);backdrop-filter:blur(16px);box-shadow:0 12px 40px rgba(0,0,0,.35);color:#fff;text-decoration:none;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.04em;transition:transform .2s,border-color .2s}
        .creator-nav span{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#55f5ff,#9c70ff);color:#08050d;font-size:12px}
        .creator-nav:hover{transform:translateY(-2px);border-color:rgba(120,239,255,.5)}
        @media(max-width:600px){.creator-nav{right:12px;bottom:12px;padding:9px 11px}.creator-nav b{display:none}}
      `}</style>
    </a>
  );
}
