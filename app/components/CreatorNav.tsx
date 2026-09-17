"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  ["Studio", "/"], ["Create", "/?workspace=create"], ["Director", "/director"],
  ["Projects", "/projects"], ["Editor", "/editor"], ["History", "/projects?view=history"],
  ["Explore", "/explore"], ["Profile", "/creator"], ["Settings", "/settings"],
] as const;
const icons: Record<string,string> = { Studio:"⌂",Create:"✦",Director:"✧",Projects:"▣",Editor:"◫",History:"◷",Explore:"◇",Profile:"◉",Settings:"⚙" };

export default function CreatorNav(){
 const router=useRouter();
 const pathname=usePathname();
 const [workspace,setWorkspace]=useState<string | null>(null);

 useEffect(()=>{
  const sync=()=>setWorkspace(new URLSearchParams(window.location.search).get("workspace"));
  sync();
  window.addEventListener("popstate",sync);
  return ()=>window.removeEventListener("popstate",sync);
 },[]);

 const go=(label:string,href:string)=>{
  if(pathname==="/" && href.startsWith("/?workspace=")) setWorkspace(href.split("workspace=")[1] || null);
  if(href==="/") setWorkspace(null);
  router.push(href);
 };

 return <nav aria-label="KIRAVO workspace navigation" className="creator-nav"><div className="creator-nav-scroll">{items.map(([label,href])=>{
  const active=pathname==="/"
   ? (label==="Studio" ? !workspace : label.toLowerCase()===workspace)
   : (href.split("?")[0]!=="/" && pathname.startsWith(href.split("?")[0]));
  return <button key={label} type="button" className={active?"active":""} aria-current={active?"page":undefined} onClick={()=>go(label,href)}><span>{icons[label]}</span><b>{label}</b></button>;
 })}</div><style jsx>{`
 .creator-nav{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:40;max-width:calc(100vw - 24px);padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(10,7,18,.84);backdrop-filter:blur(18px);box-shadow:0 16px 50px rgba(0,0,0,.4);color:#fff}.creator-nav-scroll{display:flex;align-items:center;gap:3px;overflow-x:auto;scrollbar-width:none}.creator-nav-scroll::-webkit-scrollbar{display:none}.creator-nav button{appearance:none;border:0;background:transparent;color:rgba(255,255,255,.62);display:flex;align-items:center;gap:6px;padding:9px 11px;border-radius:999px;cursor:pointer;white-space:nowrap;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.035em;transition:all .18s ease}.creator-nav button span{font-size:13px}.creator-nav button:hover{color:#fff;background:rgba(255,255,255,.07)}.creator-nav button.active{color:#fff;background:linear-gradient(135deg,rgba(85,245,255,.2),rgba(156,112,255,.2));box-shadow:inset 0 0 0 1px rgba(120,239,255,.18)}@media(max-width:700px){.creator-nav{bottom:10px;max-width:calc(100vw - 16px)}.creator-nav button{padding:9px 10px}.creator-nav button b{display:none}.creator-nav button span{font-size:16px}}
 `}</style></nav>;
}
