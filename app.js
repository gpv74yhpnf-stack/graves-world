/* Graves' World - renders Graves' mind from state.json. Original code, free to run. */
const PLACES = {
  crypt:{x:150,y:345,name:"the Crypt (home)"},
  lantern_lane:{x:390,y:360,name:"Lantern Lane"},
  offering_stone:{x:520,y:395,name:"the Offering Stone"},
  bone_garden:{x:660,y:365,name:"the Bone Garden"},
  ledger_shop:{x:865,y:345,name:"the Ledger Shop"}
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ago = iso => { if(!iso) return ""; const m = Math.round((Date.now()-new Date(iso))/60000);
  if (m<1) return "just now"; if (m<60) return m+" min ago"; const h=Math.round(m/60); if(h<48) return h+" h ago"; return Math.round(h/24)+" days ago"; };

function gravesSVG(x,y,s=1){ // little hooded necromancer, face hidden in shadow, two glowing eyes
  return `<g transform="translate(${x},${y}) scale(${s})"><g id="graves">
   <ellipse cx="0" cy="58" rx="34" ry="7" fill="#000" opacity=".35"/>
   <path d="M-30 55 Q-34 5 -18 -22 Q0 -52 18 -22 Q34 5 30 55 Q15 48 0 56 Q-15 48 -30 55Z" fill="#3b2a6e" stroke="#1a1030" stroke-width="3"/>
   <path d="M-20 -8 Q0 -42 20 -8 Q22 14 0 16 Q-22 14 -20 -8Z" fill="#120b22"/>
   <ellipse class="eye" cx="-8" cy="0" rx="4" ry="5" fill="#8ff0c8"/><ellipse class="eye" cx="8" cy="0" rx="4" ry="5" fill="#8ff0c8"/>
   <path d="M-6 -44 l6 -14 l6 14" fill="#3b2a6e" stroke="#1a1030" stroke-width="3"/>
   <path d="M-22 30 q-12 4 -18 -4" stroke="#1a1030" stroke-width="5" fill="none" stroke-linecap="round"/>
   <line x1="-40" y1="-30" x2="-40" y2="58" stroke="#8a6b4a" stroke-width="4" stroke-linecap="round"/>
   <path d="M-40 -30 q22 -6 30 10 q-14 -6 -30 2z" fill="#d9d4ea" stroke="#1a1030" stroke-width="2"/>
   <g transform="translate(34,24)"><line x1="0" y1="-14" x2="0" y2="-2" stroke="#1a1030" stroke-width="2"/>
     <rect x="-8" y="-2" width="16" height="20" rx="4" fill="#5a4630" stroke="#1a1030" stroke-width="2"/>
     <circle class="flame" cx="0" cy="8" r="6" fill="#ffc96b"/><circle cx="0" cy="8" r="16" fill="#ffc96b" opacity=".15" class="flame"/></g>
  </g></g>`;
}
function townSVG(state){
  const p = PLACES[state.location] || PLACES.crypt;
  const night = /night|evening|dusk/i.test(state.time_of_day||"");
  const stars = Array.from({length:40},(_,i)=>`<circle cx="${(i*97)%1000}" cy="${(i*53)%200}" r="${i%3?1:1.8}" fill="#fff" opacity="${night?.8:.3}"/>`).join("");
  return `<svg viewBox="0 0 1000 480" role="img" aria-label="Graves in his underworld town, at ${esc(p.name)}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night?"#140e2a":"#3d2d6b"}"/><stop offset="1" stop-color="${night?"#2b2050":"#7a5a9e"}"/></linearGradient>
  <radialGradient id="moon"><stop offset="0" stop-color="#fff7da"/><stop offset="1" stop-color="#fff7da" stop-opacity="0"/></radialGradient></defs>
  <rect width="1000" height="480" fill="url(#sky)"/>${stars}
  <circle cx="820" cy="80" r="70" fill="url(#moon)" opacity=".5"/><circle cx="820" cy="80" r="30" fill="#fff3c9"/>
  <path d="M0 300 Q150 240 300 290 T620 280 T1000 290 V480 H0Z" fill="#251b44"/>
  <path d="M0 360 Q250 320 500 350 T1000 345 V480 H0Z" fill="#33275c"/>
  <!-- crypt -->
  <g transform="translate(150,300)"><path d="M-70 60 V-10 Q0 -80 70 -10 V60Z" fill="#4a3e78" stroke="#1a1030" stroke-width="4"/>
   <path d="M-25 60 V10 Q0 -20 25 10 V60Z" fill="#120b22"/><path d="M0 -70 v-30 M-12 -88 h24" stroke="#1a1030" stroke-width="5"/>
   <circle cx="0" cy="-35" r="7" fill="#ffc96b" class="flame"/></g>
  <!-- lantern lane -->
  ${[300,360,420,480].map((x,i)=>`<g transform="translate(${x},${330-i%2*6})"><line x1="0" y1="0" x2="0" y2="-70" stroke="#1a1030" stroke-width="4"/><rect x="-7" y="-82" width="14" height="16" rx="3" fill="#ffc96b" class="flame"/><circle cx="0" cy="-74" r="22" fill="#ffc96b" opacity=".12"/></g>`).join("")}
  <!-- offering stone -->
  <g transform="translate(520,380)"><ellipse cx="0" cy="22" rx="40" ry="8" fill="#000" opacity=".3"/><path d="M-30 22 Q-34 -18 0 -24 Q34 -18 30 22Z" fill="#6a6290" stroke="#1a1030" stroke-width="3"/>
   <path d="M-12 -2 h24 M-8 8 h16" stroke="#8ff0c8" stroke-width="3" opacity=".8"/>${(state.offerings_waiting||0)>0?`<rect x="10" y="-36" width="22" height="15" rx="2" fill="#f4ead2" stroke="#1a1030" stroke-width="2" transform="rotate(12)"/>`:""}</g>
  <!-- bone garden -->
  <g transform="translate(660,350)">${[-50,-20,10,40].map((x,i)=>`<g transform="translate(${x},0)"><line x1="0" y1="0" x2="0" y2="-30" stroke="#5fae84" stroke-width="3"/><circle cx="0" cy="-34" r="${7+i%2*3}" fill="${["#ff8fb1","#c9a7ff","#8ff0c8","#ffc96b"][i]}"/></g>`).join("")}
   <path d="M-70 10 h140" stroke="#d9d4ea" stroke-width="6" stroke-linecap="round" stroke-dasharray="14 8"/></g>
  <!-- ledger shop -->
  <g transform="translate(865,300)"><rect x="-75" y="-40" width="150" height="100" fill="#5a4630" stroke="#1a1030" stroke-width="4"/>
   <path d="M-90 -40 L0 -100 L90 -40Z" fill="#7a3b5e" stroke="#1a1030" stroke-width="4"/><rect x="-50" y="-15" width="40" height="35" fill="#ffc96b" class="flame"/>
   <rect x="15" y="0" width="35" height="60" fill="#2a1a10"/><text x="0" y="-55" text-anchor="middle" font-size="16" fill="#ffe7a8" font-family="Georgia">LEDGER</text></g>
  ${Object.values(PLACES).map(q=>`<text x="${q.x}" y="470" text-anchor="middle" font-size="13" fill="#b8a9d9" opacity="${q===p?1:.45}">${esc(q.name.replace(" (home)",""))}</text>`).join("")}
  ${gravesSVG(p.x+(p===PLACES.offering_stone?-75:0), p.y-40, 1.25)}
  </svg>`;
}
async function loadState(){
  const C = window.GRAVES_CONFIG || {}, I = C.stateIssue;
  const cached = sessionStorage.getItem("graves_state");
  if (cached){ const c = JSON.parse(cached); if (Date.now()-c.at < 120000) return c.s; }
  if (I) try {
    const r = await fetch(`https://api.github.com/repos/${I.owner}/${I.repo}/issues/${I.number}`, {headers:{Accept:"application/vnd.github+json"}});
    if (r.ok){ const body = (await r.json()).body || ""; const m = body.match(/```json\s*([\s\S]*?)```/);
      const s = JSON.parse(m ? m[1] : body); sessionStorage.setItem("graves_state", JSON.stringify({at:Date.now(), s})); return s; }
  } catch(e){ console.warn("live mind unreachable, using state.json", e); }
  const r = await fetch("state.json?ts="+Date.now(), {cache:"no-store"});
  return r.json();
}
function bar(label,v){return `<div class="small dim">${esc(label)} <span style="float:right">${v}</span></div><div class="bar"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div>`;}

function renderHome(s){
  $("#scene").innerHTML = townSVG(s);
  const p = PLACES[s.location]||PLACES.crypt;
  $("#now").innerHTML = `
   <div><div class="pill">Mood</div><div class="big">${esc(s.mood?.label)}</div><div class="dim small">${esc(s.mood?.why||"")}</div></div>
   <div><div class="pill">Doing</div><div class="big">${esc(s.activity)}</div><div class="dim small">at ${esc(p.name)} · ${esc(s.time_of_day||"")}, ${esc(s.weather||"")}</div></div>
   <div><div class="pill">Feelings</div>${Object.entries(s.needs||{}).map(([k,v])=>bar(k,v)).join("")}</div>`;
  $("#thought").innerHTML = `&ldquo;${esc(s.thought)}&rdquo; <div class="dim small">updated ${ago(s.updated)} · day ${esc(s.day)} of his afterlife</div>`;
  $("#moves").innerHTML = (s.recent_moves||[]).slice(0,8).map(m=>`<li><b>${esc(m.t)}</b> ${esc(m.did)}${m.why?` <span class="dim">— because: “${esc(m.why)}”</span>`:""}</li>`).join("");
  $("#replies").innerHTML = (s.replies||[]).slice(0,5).map(r=>`<div class="entry"><div class="dim small">to <b>${esc(r.to)}</b> · ${esc(r.date)}</div><div class="dim">“${esc(r.offering)}”</div><div>${esc(r.reply)}</div></div>`).join("") || `<p class="dim">No letters answered yet. Be the first to leave one.</p>`;
  // remember the visitor
  const me = localStorage.getItem("graves_visitor");
  if (me){
    const v = (s.visitors||{})[me.toLowerCase()];
    $("#welcome").hidden = false;
    $("#welcome").innerHTML = v
      ? `<h2>Graves remembers you, ${esc(me)}</h2><p>${esc(v.greeting||"Oh! You came back.")}</p>${v.reply?`<p class="dim">His last note to you: “${esc(v.reply)}”</p>`:""}`
      : `<h2>Welcome back, ${esc(me)}</h2><p class="dim">Graves hasn't read your offering yet. He reads them in his own time (about once a day), so check back.</p>`;
    const n = document.querySelector("[name=name]"); if (n && !n.value) n.value = me;
  }
  if (location.hash === "#sent") { $("#sentmsg").hidden=false; }
}
function renderMemories(s){
  $("#journal").innerHTML = (s.journal||[]).map(j=>`<div class="entry"><div class="dim small">Day ${esc(j.day)} · ${esc(j.date)}</div><h3>${esc(j.title)}</h3><p>${esc(j.text)}</p></div>`).join("");
  $("#keep").innerHTML = (s.memories?.keeping||[]).map(m=>`<li>${esc(m.text)} <span class="dim small">(${esc(m.since)})</span></li>`).join("");
  $("#fade").innerHTML = (s.memories?.fading||[]).map(m=>`<li class="fade">${esc(m.text)}</li>`).join("") || "<li class='dim'>Nothing fading yet.</li>";
  $("#visitors").innerHTML = Object.entries(s.visitors||{}).map(([k,v])=>`<li><b>${esc(v.display||k)}</b> <span class="dim small">first met ${esc(v.first_seen)}</span> — ${esc((v.notes||[]).join("; "))}</li>`).join("") || "<li class='dim'>No visitors remembered yet.</li>";
}
function renderSheet(s){
  const sh = s.sheet||{};
  $("#given").innerHTML = (sh.given||[]).map(t=>`<li>${esc(t)}</li>`).join("");
  $("#locked").innerHTML = (sh.locked||[]).map(t=>`<li class="lock">🔒 ${esc(t)}</li>`).join("");
  $("#added").innerHTML = (sh.added||[]).map(a=>`<li class="add">+ ${esc(a.text)} <span class="dim small">(night of ${esc(a.date)})</span></li>`).join("") || "<li class='dim'>Nothing yet. He adds to this while he sleeps.</li>";
  $("#stats").innerHTML = Object.entries(s.stats||{}).map(([k,v])=>`<div class="item"><div class="dim small">${esc(k.replace(/_/g," "))}</div><div class="price">${esc(v)}</div></div>`).join("");
}
async function renderShop(){
  const el = $("#shop"); if(!el) return;
  const items = await (await fetch("shop.json")).json();
  const limit = +el.dataset.limit || items.length;
  el.innerHTML = items.slice(0,limit).map(i=>`<div class="item"><div>${esc(i.name)}</div><div><div class="price">$${Number(i.price).toFixed(2)}</div><a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener">Get it</a></div></div>`).join("");
}
function wireForm(){
  const f = $("#offering"); if(!f) return;
  const C = window.GRAVES_CONFIG || {};
  const url = C.ntfyServer + "/" + C.ntfyTopic;
  f.addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn = f.querySelector("button"); const out = $("#formstatus");
    if (f.querySelector("[name=_honey]").value) return;
    const name = f.querySelector("[name=name]").value.trim().slice(0,40);
    const message = f.querySelector("[name=message]").value.trim().slice(0,1500);
    const picture_url = f.querySelector("[name=picture_url]").value.trim().slice(0,500);
    const file = f.querySelector("[name=attachment]").files[0];
    if (!message && !file && !picture_url) { out.textContent = "Leave him at least a few words or a picture."; return; }
    btn.disabled = true; out.textContent = "Carrying it to the stone…";
    const payload = {kind:"offering", name, message, picture_url, sent:new Date().toISOString(), page:location.href};
    try {
      let r;
      if (file) {
        if (file.size > 5*1024*1024) throw new Error("That picture is over 5 MB.");
        r = await fetch(url, {method:"PUT", body:file, headers:{"Filename":file.name.replace(/[^\w.\-]/g,"_"), "Title":"offering-with-picture", "X-Message":encodeURIComponent(JSON.stringify(payload))}});
      } else {
        r = await fetch(url, {method:"POST", body:JSON.stringify(payload), headers:{"Title":"offering"}});
      }
      if (!r.ok) throw new Error("The stone didn't take it (" + r.status + "). Try again in a bit.");
      if (name) localStorage.setItem("graves_visitor", name);
      f.reset(); if (name) f.querySelector("[name=name]").value = name;
      out.textContent = ""; $("#sentmsg").hidden = false; $("#sentmsg").scrollIntoView({behavior:"smooth"});
    } catch(e){ out.textContent = e.message || "Something went wrong. Try again."; }
    btn.disabled = false;
  });
}
document.addEventListener("DOMContentLoaded", async ()=>{
  const page = document.body.dataset.page;
  document.querySelectorAll("nav a").forEach(a=>{ if(a.getAttribute("href").startsWith(page)) a.classList.add("on"); });
  wireForm(); renderShop();
  try {
    const s = await loadState();
    ({home:renderHome, memories:renderMemories, sheet:renderSheet}[page]||(()=>{}))(s);
    if (page==="home") setInterval(async()=>renderHome(await loadState()), 300000);
  } catch(e){ console.error(e); }
});
