/* Graves' World 3D. Original code; every model, texture and sound is generated here at runtime.
   Engine: three.js r160 (MIT) from jsDelivr. Live state: same GitHub issue #1 read by app.js loadState(). */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CHUNK_SIZE, CHUNK_LOAD_RADIUS, CHUNK_UNLOAD_RADIUS, UNDERWORLD_BIOMES, biomeForChunk, chunksAround, createChunkRandom, landmarkForCell, landmarkForChunk, landmarkInscriptionFor, worldGroundHeight } from './src/worldgen/undercroft.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MOBILE = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const SHOT = new URLSearchParams(location.search).get('shot'); // used for headless screenshots
let QUALITY = +(localStorage.getItem('g3d_q') ?? (MOBILE ? 1 : 2)); // 0 low, 1 medium, 2 high
let renderScale = 1; const PIXEL_RATIO_CAP = [1, 1.5, 2];
const HEADING_NAMES = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
const COMPASS_SHORT_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------- places (keys match state.location) ---------- */
const PLACES = {
  crypt:          { name:"The Crypt",          pos:new THREE.Vector3(-24,0,-8),  stand:new THREE.Vector3(-24,0,-3.2), ring:new THREE.Vector3(-24,0,-2.2), r:2.4, open:"Read his journal" },
  lantern_lane:   { name:"Lantern Lane",       pos:new THREE.Vector3(-11,0,2),   stand:new THREE.Vector3(-11,0,3.5),  ring:new THREE.Vector3(-11,0,5),    r:2.4, open:"See how he's doing" },
  offering_stone: { name:"The Offering Stone", pos:new THREE.Vector3(1,0,9),     stand:new THREE.Vector3(-2.6,0,10.6), ring:new THREE.Vector3(1.4,0,12.2),   r:2.4, open:"Leave an offering" },
  bone_garden:    { name:"The Bone Garden",    pos:new THREE.Vector3(13,0,0),    stand:new THREE.Vector3(12,0,3),     ring:new THREE.Vector3(13,0,4.6),   r:2.4, open:"Read his letters" },
  ledger_shop:    { name:"The Ledger Shop",    pos:new THREE.Vector3(25,0,-8),   stand:new THREE.Vector3(22,0,-3.4),  ring:new THREE.Vector3(25,0,-2.4),  r:2.4, open:"Browse the shop" },
  grand_library:  { name:"The Grand Library",  pos:new THREE.Vector3(0,0,-25),   stand:new THREE.Vector3(0,0,-16.8), ring:new THREE.Vector3(0,0,-14.8), r:2.6, open:"Enter the Grand Library" },
};
const KEYS = Object.keys(PLACES);
const solids = []; // {x,z,r} simple circle colliders
const ground = h => 0;
const groundY = worldGroundHeight;

/* ---------- renderer / scene ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_RATIO_CAP[QUALITY] * renderScale));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = QUALITY >= 2; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a1330, 0.014);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.65, 0.5, 0.78);
composer.addPass(bloom); composer.addPass(new OutputPass());
function applyQuality(){
  renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_RATIO_CAP[QUALITY] * renderScale));
  bloom.enabled = QUALITY > 0; renderer.shadowMap.enabled = QUALITY >= 2;
  resize();
}
function setRenderScale(next){ renderScale = clamp(next, .65, 1); applyQuality(); }
function resize(){ camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth / 2, innerHeight / 2); }
addEventListener('resize', resize);

/* ---------- materials ---------- */
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, flatShading: true, ...o });
const glow = (color, k = 2.5) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: k, roughness: 1 });
const MAT = {
  stone: M(0x5d5480), stoneDark: M(0x3e3760), wood: M(0x5a4030), roof: M(0x6e2f55), bone: M(0xe8e1f2, { roughness: .6 }),
  grass: M(0x2c3a3a), robe: M(0x5a3fa0, { roughness: .8, emissive: 0x1a0f36, emissiveIntensity: .6 }), robeIn: M(0x140c26), face: new THREE.MeshBasicMaterial({ color: 0x05030b }),
  iron: M(0x221a33, { metalness: .6, roughness: .5 }), paper: M(0xf4ead2), lamp: glow(0xffc96b, 3), ecto: glow(0x8ff0c8, 3), eye: glow(0x7dffb8, 6),
  pink: glow(0xff8fb1, 2.2), lilac: glow(0xc9a7ff, 2.2), bark: M(0x2a2036),
};
function add(geo, mat, x = 0, y = 0, z = 0, parent = scene){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function textTexture(text, w = 512, h = 128, fg = '#ffe7a8', bg = '#2a1a10'){
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffc96b'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = `bold ${h * .45}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const DOT = dotTexture();

/* ---------- sky, lights ---------- */
const skyUniforms = { top: { value: new THREE.Color(0x0d0920) }, bottom: { value: new THREE.Color(0x3a2a62) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+.15,0.,1.); gl_FragColor = vec4(mix(bottom, top, h),1.); }'
}));
scene.add(sky);
const starGeo = new THREE.BufferGeometry(); { const p = []; for (let i = 0; i < 900; i++){ const u = rnd() * Math.PI * 2, v = rnd() * .9 + .08; p.push(Math.cos(u) * Math.cos(v) * 180, Math.sin(v) * 180, Math.sin(u) * Math.cos(v) * 180); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, map: DOT, transparent: true, depthWrite: false, fog: false, color: 0xffffff }));
scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c9, fog: false }));
moon.position.set(60, 70, -140); scene.add(moon);
const hemi = new THREE.HemisphereLight(0x8a7ad0, 0x1a1428, 0.6); scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xb9c4ff, 0.8);
moonLight.position.set(30, 50, -20); moonLight.castShadow = true; moonLight.shadow.mapSize.set(1024, 1024);
Object.assign(moonLight.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); moonLight.shadow.bias = -0.0008;
scene.add(moonLight);

/* ---------- ground ---------- */
{
  const g = new THREE.PlaneGeometry(96, 96, 48, 48); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = []; const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, groundY(x, z) + (Math.hypot(x, z) > 30 ? (rnd() - .5) * .4 : (rnd() - .5) * .06));
    const path = Math.min(Math.abs(z - (x < -11 ? 2 + (x + 11) * -0.3 : x < 13 ? 2 + Math.sin(x * .2) * 2 : 1 - (x - 13) * .3)), 99);
    c.setHSL(.72 + rnd() * .03, .22, .13 + rnd() * .03); if (path < 2.2) c.lerp(new THREE.Color(0x4a4266), .7);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.receiveShadow = true; m.name = 'ground'; scene.add(m);
}
// cobble stones along the lane (instanced)
{
  const geo = new THREE.CylinderGeometry(.45, .5, .12, 6), inst = new THREE.InstancedMesh(geo, MAT.stoneDark, 220), d = new THREE.Object3D(); let n = 0;
  for (let x = -28; x < 28 && n < 220; x += .9){ const z = x < -11 ? 2 + (x + 11) * -0.3 : x < 13 ? 2 + Math.sin(x * .2) * 2 : 1 - (x - 13) * .3;
    for (let k = -1; k <= 1; k++){ if (rnd() < .25) continue; d.position.set(x + (rnd() - .5) * .4, .03, z + k * .95 + (rnd() - .5) * .3); d.rotation.y = rnd() * 3; d.scale.setScalar(.7 + rnd() * .5); d.updateMatrix(); inst.setMatrixAt(n++, d.matrix); } }
  inst.count = n; inst.receiveShadow = true; scene.add(inst);
}

/* ---------- lights we animate ---------- */
const flickers = []; // {light, base, mesh}
function lamp(x, z, h = 3.2, withLight = true){
  const g = new THREE.Group(); g.position.set(x, groundY(x, z), z); scene.add(g);
  add(new THREE.CylinderGeometry(.08, .12, h, 6), MAT.iron, 0, h / 2, 0, g);
  add(new THREE.BoxGeometry(.7, .08, .08), MAT.iron, .3, h - .1, 0, g);
  const cage = add(new THREE.CylinderGeometry(.22, .18, .45, 6), MAT.lamp, .6, h - .45, 0, g);
  add(new THREE.ConeGeometry(.3, .25, 6), MAT.iron, .6, h - .12, 0, g);
  if (withLight){ const L = new THREE.PointLight(0xffb350, 6, 11, 1.6); L.position.set(.6, h - .5, 0); g.add(L); flickers.push({ light: L, base: 6, mesh: cage, ph: rnd() * 9 }); }
  solids.push({ x, z, r: .5 });
  return g;
}

/* ---------- buildings ---------- */
function crypt(){
  const p = PLACES.crypt.pos, g = new THREE.Group(); g.position.copy(p); scene.add(g);
  add(new THREE.BoxGeometry(7, .5, 6), MAT.stoneDark, 0, .25, 0, g);
  add(new THREE.BoxGeometry(6, 4, 5), MAT.stone, 0, 2.5, 0, g);
  const roof = add(new THREE.CylinderGeometry(3.2, 3.2, 5.4, 12, 1, false, 0, Math.PI), MAT.stoneDark, 0, 4.5, 0, g); roof.rotation.set(0, 0, Math.PI / 2); roof.rotation.order = 'ZYX'; roof.rotation.y = Math.PI / 2;
  add(new THREE.BoxGeometry(2, 3, .3), MAT.face, 0, 2, 2.42, g);
  const arch = add(new THREE.CylinderGeometry(1, 1, .32, 16, 1, false, 0, Math.PI), MAT.face, 0, 3.5, 2.42, g); arch.rotation.set(Math.PI / 2, Math.PI / 2, 0); arch.rotation.order = 'XZY'; arch.rotation.set(Math.PI/2,0,Math.PI/2);
  add(new THREE.BoxGeometry(.25, 1.6, .25), MAT.stoneDark, 0, 8.3, 0, g); add(new THREE.BoxGeometry(1, .25, .25), MAT.stoneDark, 0, 8.6, 0, g);
  for (const s of [-1, 1]){ add(new THREE.CylinderGeometry(.35, .4, 4.5, 8), MAT.stoneDark, s * 3.2, 2.5, 2.6, g); add(new THREE.SphereGeometry(.45, 8, 6), MAT.stoneDark, s * 3.2, 5, 2.6, g); }
  const c = add(new THREE.SphereGeometry(.18, 8, 6), MAT.lamp, 0, 5.6, 2.7, g); const L = new THREE.PointLight(0x7dffb8, 5, 9, 1.6); L.position.set(0, 2.2, 3.2); g.add(L); flickers.push({ light: L, base: 5, mesh: c, ph: 1 });
  add(new THREE.SphereGeometry(.5, 8, 6), MAT.ecto, 0, 1.4, 2.4, g).scale.set(1.4, 2, .2);
  solids.push({ x: p.x, z: p.z, r: 4.2 });
}
function shop(){
  const p = PLACES.ledger_shop.pos, g = new THREE.Group(); g.position.copy(p); scene.add(g); g.rotation.y = -0.25;
  add(new THREE.BoxGeometry(6.5, 4, 5.5), MAT.wood, 0, 2, 0, g);
  const roof = add(new THREE.ConeGeometry(5.4, 3.2, 4), MAT.roof, 0, 5.6, 0, g); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, .95);
  add(new THREE.BoxGeometry(.8, 2.5, .8), MAT.stoneDark, 2, 6, -1, g); // chimney
  add(new THREE.BoxGeometry(1.4, 2.4, .2), MAT.face, 1.6, 1.2, 2.8, g); // door
  for (const x of [-1.8]){ add(new THREE.BoxGeometry(1.8, 1.4, .2), MAT.lamp, x, 2.2, 2.78, g); add(new THREE.BoxGeometry(2, .15, .3), MAT.wood, x, 1.45, 2.85, g); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .9), new THREE.MeshStandardMaterial({ map: textTexture('LEDGER SHOP'), emissive: 0xffffff, emissiveMap: textTexture('LEDGER SHOP'), emissiveIntensity: .9 }));
  sign.position.set(0, 4.35, 2.81); g.add(sign);
  const L = new THREE.PointLight(0xffb350, 7, 12, 1.6); L.position.set(-1.8, 2.3, 4); g.add(L); flickers.push({ light: L, base: 7, ph: 3 });
  // crates and a ledger book on a stand
  add(new THREE.BoxGeometry(.9, .9, .9), MAT.wood, -3.8, .45, 2.4, g); add(new THREE.BoxGeometry(.7, .7, .7), MAT.wood, -3.7, 1.25, 2.3, g).rotation.y = .5;
  add(new THREE.BoxGeometry(.9, .15, .65), MAT.paper, 3.9, 1.2, 2.2, g); add(new THREE.CylinderGeometry(.08, .1, 1.1, 6), MAT.wood, 3.9, .55, 2.2, g);
  solids.push({ x: p.x, z: p.z, r: 4.3 });
}
// The Grand Library: a moonstone scriptorium with twin lantern towers, a rose window,
 // deep-blue roofs and a welcoming, illuminated doorway. All geometry is original.
const libraryMotes = [];
function grandLibrary(){
  const p = PLACES.grand_library.pos, g = new THREE.Group(); g.position.copy(p); scene.add(g);
  const blueStone = M(0x35466f), paleStone = M(0x7783a8), blueRoof = M(0x26365f), darkGlass = M(0x101a36);
  const windowGlow = glow(0x8eb7ff, 2.1), goldGlow = glow(0xffd58a, 2.4);
  // broad foundation and central hall
  add(new THREE.BoxGeometry(17, .7, 13), MAT.stoneDark, 0, .35, 0, g);
  add(new THREE.BoxGeometry(12, 8.5, 9), blueStone, 0, 4.85, 0, g);
  add(new THREE.BoxGeometry(5, 5.8, 8), MAT.stone, -7.4, 3.5, -.3, g);
  add(new THREE.BoxGeometry(5, 5.8, 8), MAT.stone, 7.4, 3.5, -.3, g);
  // high central roof and two lower side roofs
  const roof = add(new THREE.ConeGeometry(8.4, 6.2, 4), blueRoof, 0, 12.1, 0, g); roof.rotation.y = Math.PI / 4; roof.scale.z = .82;
  for (const x of [-7.4, 7.4]) { const r = add(new THREE.ConeGeometry(3.8, 2.8, 4), MAT.roof, x, 7.1, -.2, g); r.rotation.y = Math.PI / 4; }
  // entrance porch, arch and double doors
  add(new THREE.BoxGeometry(4.4, .35, 3.2), MAT.stoneDark, 0, .25, 6.05, g);
  for (const x of [-2.05, 2.05]) {
    add(new THREE.CylinderGeometry(.24, .3, 5.6, 8), paleStone, x, 3.05, 4.35, g);
    add(new THREE.SphereGeometry(.32, 8, 6), MAT.bone, x, 5.9, 4.35, g);
  }
  add(new THREE.BoxGeometry(4.6, .35, .5), paleStone, 0, 5.9, 4.35, g);
  add(new THREE.BoxGeometry(2.8, 3.8, .22), darkGlass, 0, 2.25, 4.58, g);
  add(new THREE.BoxGeometry(1.3, 3.2, .12), M(0x18213d), -.68, 2.15, 4.72, g);
  add(new THREE.BoxGeometry(1.3, 3.2, .12), M(0x18213d), .68, 2.15, 4.72, g);
  add(new THREE.SphereGeometry(.12, 8, 6), goldGlow, 0, 2.1, 4.82, g);
  // stained-glass lancet windows along the nave
  for (const x of [-4.4, 4.4]) {
    for (const z of [-2.6, 1.1]) {
      add(new THREE.BoxGeometry(1.15, 3.2, .16), darkGlass, x, 4.8, z + 4.58, g);
      add(new THREE.BoxGeometry(.12, 3.35, .2), paleStone, x, 4.8, z + 4.68, g);
      add(new THREE.BoxGeometry(1.2, .12, .2), paleStone, x, 4.8, z + 4.68, g);
      add(new THREE.BoxGeometry(.07, 3, .22), windowGlow, x, 4.8, z + 4.72, g);
    }
  }
  // rose window above the doors
  const rose = new THREE.Group(); rose.position.set(0, 7.1, 4.62); g.add(rose);
  add(new THREE.CircleGeometry(1.18, 12), windowGlow, 0, 0, 0, rose);
  for (let i=0;i<8;i++){ const a=i*Math.PI/4; const petal=add(new THREE.SphereGeometry(.25,8,6), i%2?MAT.lilac:goldGlow, Math.cos(a)*.72,Math.sin(a)*.72,.04,rose); petal.scale.set(.7,1.5,.35); }
  add(new THREE.TorusGeometry(1.28,.12,8,32), paleStone, 0, 0, .08, rose);
  // paired towers and needle spires
  for (const x of [-6.7,6.7]) {
    add(new THREE.BoxGeometry(2.5, 10, 2.7), blueStone, x, 5.3, 3.1, g);
    add(new THREE.CylinderGeometry(1.35,1.5,2.2,8), paleStone, x, 10.7, 3.1, g);
    const spire=add(new THREE.ConeGeometry(1.65,5.5,8), blueRoof, x, 14.4, 3.1, g);
    add(new THREE.SphereGeometry(.16,8,6), goldGlow, x, 17.25, 3.1, g);
    spire.rotation.y=Math.PI/8;
    add(new THREE.BoxGeometry(.72,2.1,.18), windowGlow, x, 5.8, 4.48, g);
  }
  // carved buttresses and foundation runes
  for (const x of [-5.6,5.6]) {
    for (const z of [-3.7,3.7]) {
      const buttress=add(new THREE.BoxGeometry(.7,7.4,.8), paleStone, x, 4.1, z, g);
      buttress.rotation.z=x<0?-.08:.08;
    }
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.8,1.05), new THREE.MeshStandardMaterial({map:textTexture('THE GRAND LIBRARY',768,160,'#dce8ff','#172440'),emissive:0x8eb7ff,emissiveMap:textTexture('THE GRAND LIBRARY',768,160,'#dce8ff','#172440'),emissiveIntensity:.7}));
  sign.position.set(0,8.65,4.72); g.add(sign);
  const L=new THREE.PointLight(0x8eb7ff,7,24,1.5); L.position.set(0,7,6); g.add(L); flickers.push({light:L,base:7,ph:2.4});
  const warm=new THREE.PointLight(0xffc96b,4,13,1.7); warm.position.set(0,3,5.5); g.add(warm); flickers.push({light:warm,base:4,ph:5.2});
  // a little constellation of turning book-shaped relics above the entrance
  for(let i=0;i<5;i++){
    const book=new THREE.Group(); book.position.set((i-2)*1.05,8.9+Math.sin(i*1.7)*.45,7.2+(i%2)*.45); g.add(book);
    const cover=add(new THREE.BoxGeometry(.55,.72,.12),i%2?MAT.roof:blueRoof,0,0,0,book);
    add(new THREE.BoxGeometry(.43,.62,.035),MAT.paper,0,0,.075,book);
    const sigil=add(new THREE.BoxGeometry(.12,.18,.02),goldGlow,0,0,.1,book);
    libraryMotes.push({book,phase:i*1.3,speed:.35+i*.06});
  }
  solids.push({x:p.x,z:p.z,r:7.4});
}
const stoneNote = new THREE.Group();
function offeringStone(){
  const p = PLACES.offering_stone.pos, g = new THREE.Group(); g.position.copy(p); scene.add(g);
  const s = add(new THREE.DodecahedronGeometry(1.4, 0), MAT.stone, 0, 1.1, 0, g); s.scale.set(1.2, .9, .9);
  add(new THREE.CylinderGeometry(2.2, 2.5, .3, 10), MAT.stoneDark, 0, .15, 0, g);
  const rune = add(new THREE.TorusGeometry(.6, .05, 6, 24), MAT.ecto, 0, 1.3, 1.25, g); rune.scale.y = 1.1;
  add(new THREE.BoxGeometry(.6, .05, .02), MAT.ecto, 0, 1.3, 1.27, g); add(new THREE.BoxGeometry(.05, .7, .02), MAT.ecto, 0, 1.3, 1.27, g);
  for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; const c = add(new THREE.CylinderGeometry(.08, .08, .3, 6), MAT.paper, Math.cos(a) * 1.9, .45, Math.sin(a) * 1.9, g); add(new THREE.SphereGeometry(.07, 6, 4), MAT.lamp, Math.cos(a) * 1.9, .66, Math.sin(a) * 1.9, g); }
  const L = new THREE.PointLight(0x8ff0c8, 4, 8, 1.6); L.position.set(0, 2.5, 1.5); g.add(L); flickers.push({ light: L, base: 4, ph: 5 });
  add(new THREE.BoxGeometry(.7, .03, .5), MAT.paper, 0, 0, 0, stoneNote); stoneNote.position.set(.3, 2.0, .1); stoneNote.rotation.set(-.1, .5, .15); stoneNote.visible = false; g.add(stoneNote);
  solids.push({ x: p.x, z: p.z, r: 2.4 });
}
const flowers = [];
function boneGarden(){
  const p = PLACES.bone_garden.pos, g = new THREE.Group(); g.position.copy(p); scene.add(g);
  const mats = [MAT.pink, MAT.lilac, MAT.ecto, MAT.lamp];
  for (let i = 0; i < 26; i++){ const a = rnd() * Math.PI * 2, r = 1 + rnd() * 3.3, x = Math.cos(a) * r, z = Math.sin(a) * r - .5, h = .5 + rnd() * .7;
    add(new THREE.CylinderGeometry(.03, .04, h, 4), M(0x3f8a66), x, h / 2, z, g);
    const f = add(new THREE.IcosahedronGeometry(.13 + rnd() * .08, 0), mats[i % 4], x, h + .08, z, g); flowers.push({ m: f, ph: rnd() * 9, y: h + .08 }); }
  // bone fence
  for (let i = 0; i < 18; i++){ const a = i / 18 * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < .35) continue; const x = Math.cos(a) * 4.6, z = Math.sin(a) * 4.6 - .5;
    add(new THREE.CylinderGeometry(.09, .09, 1.1, 6), MAT.bone, x, .55, z, g); add(new THREE.SphereGeometry(.15, 6, 4), MAT.bone, x, 1.15, z, g); }
  const skull = new THREE.Group(); skull.position.set(0, .8, -.6); g.add(skull);
  add(new THREE.SphereGeometry(.45, 10, 8), MAT.bone, 0, 0, 0, skull); add(new THREE.SphereGeometry(.1, 6, 4), MAT.face, -.16, .02, .38, skull); add(new THREE.SphereGeometry(.1, 6, 4), MAT.face, .16, .02, .38, skull);
  add(new THREE.CylinderGeometry(.5, .6, .5, 8), MAT.stoneDark, 0, .25, -.6, g);
  const L = new THREE.PointLight(0xc9a7ff, 3, 8, 1.6); L.position.set(0, 1.8, 0); g.add(L);
  solids.push({ x: p.x, z: p.z - .6, r: .9 });
}
function deadTree(x, z, s = 1){
  const g = new THREE.Group(); g.position.set(x, groundY(x, z), z); g.scale.setScalar(s); g.rotation.y = rnd() * 6; scene.add(g);
  const branch = (parent, len, rad, depth) => {
    const b = add(new THREE.CylinderGeometry(rad * .6, rad, len, 5), MAT.bark, 0, len / 2, 0, parent);
    const tip = new THREE.Group(); tip.position.y = len; parent.add(tip);
    if (depth > 0) for (let i = 0; i < 2 + (rnd() < .4); i++){ const c = new THREE.Group(); c.rotation.set((rnd() - .5) * 1.6, rnd() * 6, (rnd() * .6 + .4) * (rnd() < .5 ? -1 : 1)); tip.add(c); branch(c, len * (.55 + rnd() * .2), rad * .6, depth - 1); }
  };
  branch(g, 2.6, .28, 3); solids.push({ x, z, r: .6 * s });
}
function gravestone(x, z){ const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set((rnd() - .5) * .25, (rnd() - .5) * .8, (rnd() - .5) * .2); scene.add(g);
  if (rnd() < .5){ add(new THREE.BoxGeometry(.8, 1.1, .2), MAT.stone, 0, .5, 0, g); add(new THREE.CylinderGeometry(.4, .4, .2, 10, 1, false, 0, Math.PI), MAT.stone, 0, 1.05, 0, g).rotation.set(Math.PI / 2, 0, Math.PI / 2); }
  else { add(new THREE.BoxGeometry(.16, 1.3, .16), MAT.stone, 0, .65, 0, g); add(new THREE.BoxGeometry(.7, .16, .16), MAT.stone, 0, .95, 0, g); }
  solids.push({ x, z, r: .5 }); }

crypt(); shop(); offeringStone(); boneGarden(); grandLibrary();
 // a processional cobble walk draws the eye from the old square to the new archive
{
  const geo=new THREE.CylinderGeometry(.34,.38,.1,6), inst=new THREE.InstancedMesh(geo,MAT.stoneDark,110), d=new THREE.Object3D(); let n=0;
  for(let z=-14.5;z<2.5;z+=.62) for(let x of [-.72,0,.72]){
    d.position.set(x,.045,z+(rnd()-.5)*.16); d.rotation.y=rnd()*2; d.scale.setScalar(.78+rnd()*.3); d.updateMatrix(); inst.setMatrixAt(n++,d.matrix);
  }
  inst.count=n; inst.receiveShadow=true; scene.add(inst);
}
[[-20, 4.3], [-15, 6], [-10, 6.6], [-5, 6.2], [-17, -.8], [-7, -.6], [6, 6.5], [17, 6], [20, -1]].forEach(([x, z], i) => lamp(x, z, 3.2, QUALITY > 0 ? i % 2 === 0 : i % 4 === 0));
[[-31, -2], [-30, 9], [-18, -12], [-6, -9], [5, -10], [8, 16], [-8, 15], [19, 12], [32, 4], [31, -16], [-34, -16], [8, -19], [-22, 14], [26, 12]].forEach(([x, z]) => deadTree(x, z, .8 + rnd() * .6));
for (let i = 0; i < 16; i++){ const x = -30 + rnd() * 14, z = -16 + rnd() * 6; if (Math.hypot(x - PLACES.crypt.pos.x, z - PLACES.crypt.pos.z) > 5) gravestone(x, z); }
for (let i = 0; i < 8; i++){ gravestone(-4 + rnd() * 10, -6 - rnd() * 5); }
// distant spires for silhouette
for (let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2 + rnd() * .2, r = 70 + rnd() * 30, h = 10 + rnd() * 30; const m = add(new THREE.ConeGeometry(2 + rnd() * 4, h, 5), MAT.stoneDark, Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); m.castShadow = false; }

/* ---------- ground rings at each place ---------- */
const rings = {}, ringMat = new THREE.MeshBasicMaterial({ color: 0xffc96b, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
for (const k of KEYS){ const r = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.55, 40), ringMat.clone()); r.rotation.x = -Math.PI / 2; r.position.copy(PLACES[k].ring).setY(.06); scene.add(r); rings[k] = r; }

/* ---------- Graves (procedural hooded necromancer) ---------- */
function makeGraves(){
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // robe: lathe with a tattered hem
  const pts = []; for (let i = 0; i <= 10; i++){ const t = i / 10; pts.push(new THREE.Vector2(lerp(.62, .26, Math.pow(t, .8)), t * 1.25)); }
  const robeGeo = new THREE.LatheGeometry(pts, 14); { const p = robeGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < .02){ const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, (Math.sin(a * 7) > 0 ? -.08 : .06)); } robeGeo.computeVertexNormals(); }
  const robe = add(robeGeo, MAT.robe, 0, .12, 0, body);
  // hood
  const hood = add(new THREE.SphereGeometry(.42, 14, 10), MAT.robe, 0, 1.52, -.02, body); hood.scale.set(1, 1.05, 1.08);
  const tip = add(new THREE.ConeGeometry(.22, .55, 8), MAT.robe, 0, 1.92, -.22, body); tip.rotation.x = -.7;
  const face = add(new THREE.SphereGeometry(.31, 12, 8), MAT.face, 0, 1.47, .16, body); face.scale.set(1, .95, .7);
  const eyes = []; for (const s of [-1, 1]){ const e = add(new THREE.SphereGeometry(.055, 8, 6), MAT.eye, s * .11, 1.5, .39, body); e.scale.set(1, 1.35, .6); e.castShadow = false; eyes.push(e); }
  const eyeLight = new THREE.PointLight(0x7dffb8, 2.5, 4, 2); eyeLight.position.set(0, 1.5, .7); body.add(eyeLight);
  // mantle + belt + bone clasp
  add(new THREE.TorusGeometry(.38, .09, 6, 14), MAT.robe, 0, 1.18, 0, body).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(.43, .04, 5, 16), MAT.wood, 0, .72, 0, body).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(.07, 6, 4), MAT.bone, 0, 1.12, .38, body);
  // sleeves/arms
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.42, 1.08, 0); armR.position.set(.42, 1.08, 0); body.add(armL, armR);
  for (const [a, s] of [[armL, -1], [armR, 1]]){ const sl = add(new THREE.CylinderGeometry(.11, .17, .55, 7), MAT.robe, 0, -.25, 0, a); sl.rotation.z = s * .25; add(new THREE.SphereGeometry(.07, 6, 4), MAT.bone, s * .07, -.55, .02, a); }
  // staff (right) with skull + soul crystal
  const staff = new THREE.Group(); staff.position.set(.1, -.55, .08); armR.add(staff);
  add(new THREE.CylinderGeometry(.035, .045, 2.1, 6), MAT.wood, 0, .35, 0, staff);
  add(new THREE.SphereGeometry(.14, 8, 6), MAT.bone, 0, 1.45, 0, staff);
  const crystal = add(new THREE.OctahedronGeometry(.12, 0), MAT.ecto, 0, 1.72, 0, staff); crystal.castShadow = false;
  // lantern (left)
  const lant = new THREE.Group(); lant.position.set(-.05, -.6, .1); armL.add(lant);
  add(new THREE.CylinderGeometry(.01, .01, .25, 4), MAT.iron, 0, -.1, 0, lant);
  const lf = add(new THREE.CylinderGeometry(.1, .09, .2, 6), MAT.lamp, 0, -.32, 0, lant); lf.castShadow = false;
  const lantLight = new THREE.PointLight(0xffb350, 2.2, 5, 2); lantLight.position.set(0, -.32, .1); lant.add(lantLight);
  // shadow blob
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.6, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = .03; root.add(blob);
  root.scale.setScalar(1.45);
  return { root, body, robe, eyes, eyeLight, armL, armR, staff, crystal, lantLight, blob };
}
const G = makeGraves(); scene.add(G.root);
G.root.position.copy(PLACES.crypt.stand).add(new THREE.Vector3(0, 0, 1));
const graves = { target: G.root.position.clone(), wait: 0, speed: 2.4, walking: false, sleeping: false, home: 'crypt', facing: 0 };

/* ---------- the visitor's wisp ---------- */
const wisp = new THREE.Group(); scene.add(wisp);
const wcore = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), glow(0xfff0b8, 3)); wisp.add(wcore); wcore.scale.setScalar(.8);
const whalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: 0xffc96b, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending })); whalo.scale.setScalar(.9); wisp.add(whalo);
const wlight = new THREE.PointLight(0xffd27a, 3, 8, 1.6); wisp.add(wlight);
wisp.position.set(-2, 1.1, 16);
const TRAIL = 40, trailGeo = new THREE.BufferGeometry(), trailPos = new Float32Array(TRAIL * 3);
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
for (let i = 0; i < TRAIL; i++) trailPos.set([wisp.position.x, wisp.position.y, wisp.position.z], i * 3);
scene.add(new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: .35, map: DOT, color: 0xffc96b, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })));
const moveTarget = new THREE.Vector3().copy(wisp.position); let hasTarget = false;
const marker = new THREE.Mesh(new THREE.RingGeometry(.25, .38, 24), new THREE.MeshBasicMaterial({ color: 0x8ff0c8, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);

/* ---------- particles: fireflies + embers ---------- */
const FF = [0, 120, 260][QUALITY] + 60, ffGeo = new THREE.BufferGeometry(), ffPos = new Float32Array(FF * 3), ffSeed = new Float32Array(FF);
for (let i = 0; i < FF; i++){ ffPos.set([(rnd() - .5) * 70, .4 + rnd() * 4, (rnd() - .5) * 46], i * 3); ffSeed[i] = rnd() * 100; }
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const ffMat = new THREE.PointsMaterial({ size: .28, map: DOT, color: 0xc6ff8a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const fireflies = new THREE.Points(ffGeo, ffMat); scene.add(fireflies);
const EM = 70, emGeo = new THREE.BufferGeometry(), emPos = new Float32Array(EM * 3), emV = [];
const emitters = [PLACES.ledger_shop.pos.clone().add(new THREE.Vector3(1.6, 7, -1.6)), PLACES.crypt.pos.clone().add(new THREE.Vector3(0, 6, 2.7)), PLACES.offering_stone.pos.clone().add(new THREE.Vector3(0, 2, 0))];
for (let i = 0; i < EM; i++){ const e = emitters[i % 3]; emPos.set([e.x, e.y + rnd() * 3, e.z], i * 3); emV.push(rnd()); }
emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
const embers = new THREE.Points(emGeo, new THREE.PointsMaterial({ size: .18, map: DOT, color: 0xff9a4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(embers);
// low ground mist sprites
const mists = []; { const mm = new THREE.SpriteMaterial({ map: DOT, color: 0x8f7fc8, transparent: true, opacity: .1, depthWrite: false });
  for (let i = 0; i < [6, 14, 22][QUALITY]; i++){ const s = new THREE.Sprite(mm); s.position.set((rnd() - .5) * 60, .8, (rnd() - .5) * 36); s.scale.set(14, 4, 1); scene.add(s); mists.push({ s, v: .2 + rnd() * .3 }); } }

/* ---------- day/night from America/Chicago time ---------- */
function chicagoNow(){
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const h = +parts.find(p => p.type === 'hour').value % 24, m = +parts.find(p => p.type === 'minute').value; return h + m / 60;
}
const PAL = { // hour: [skyTop, skyBottom, fog, hemi, light, lampsK, stars]
  night: [0x07051a, 0x24184a, 0x150f2c, .45, .55, 1.3, 1],
  dawn:  [0x2c2150, 0xc77a8a, 0x4a3458, .7, .8, .7, .3],
  day:   [0x4a3d8c, 0xa48ad0, 0x5c4c86, 1.0, 1.15, .35, 0],
  dusk:  [0x241848, 0xd0705a, 0x3c2448, .7, .8, .9, .4],
};
function palette(h){
  const key = [[0, 'night'], [5, 'night'], [6.5, 'dawn'], [9, 'day'], [16.5, 'day'], [18.5, 'dusk'], [20.5, 'night'], [24, 'night']];
  let a = key[0], b = key[1]; for (let i = 0; i < key.length - 1; i++) if (h >= key[i][0] && h <= key[i + 1][0]){ a = key[i]; b = key[i + 1]; break; }
  const t = (h - a[0]) / Math.max(.001, b[0] - a[0]), A = PAL[a[1]], B = PAL[b[1]], c = (i) => new THREE.Color(A[i]).lerp(new THREE.Color(B[i]), t);
  return { top: c(0), bottom: c(1), fog: c(2), hemi: lerp(A[3], B[3], t), light: lerp(A[4], B[4], t), lamps: lerp(A[5], B[5], t), stars: lerp(A[6], B[6], t), name: t < .5 ? a[1] : b[1] };
}
let PALNOW = palette(SHOT && SHOT !== '1' && !isNaN(+SHOT) ? +SHOT : chicagoNow()), moonAngle = 0;
function applyPalette(){
  const h = (SHOT && !isNaN(+SHOT) && SHOT !== '1') ? +SHOT : chicagoNow(); PALNOW = palette(h);
  skyUniforms.top.value.copy(PALNOW.top); skyUniforms.bottom.value.copy(PALNOW.bottom); scene.fog.color.copy(PALNOW.fog);
  hemi.intensity = PALNOW.hemi; moonLight.intensity = PALNOW.light; stars.material.opacity = PALNOW.stars;
  const sunUp = h > 6.5 && h < 18.5; moon.material.color.set(sunUp ? 0xffd9a0 : 0xfff3c9); moonLight.color.set(sunUp ? 0xffd2b0 : 0xb9c4ff);
  moonAngle = ((h - 6) / 24) * Math.PI * 2; moon.position.set(wisp.position.x + Math.cos(moonAngle) * 150, 40 + Math.abs(Math.sin(moonAngle)) * 60, wisp.position.z - 120);
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60); $('#clock').textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'} Central · ${PALNOW.name}`;
}
applyPalette(); setInterval(applyPalette, 60000);

/* ---------- live state ---------- */
let STATE = null;
const short = (t, n = 150) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
function bar(label, v){ return `<div class="small dim">${esc(label)} <span style="float:right">${v}</span></div><div class="bar"><i style="width:${clamp(v, 0, 100)}%"></i></div>`; }
const ago = iso => { if (!iso) return ""; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 48) return h + " h ago"; return Math.round(h / 24) + " days ago"; };
function applyState(s){
  STATE = s; const loc = PLACES[s.location] ? s.location : 'crypt'; graves.home = loc;
  graves.sleeping = /sleep/i.test(s.activity || '');
  stoneNote.visible = (s.offerings_waiting || 0) > 0;
  $('#mood').innerHTML = `<b>${esc(s.mood?.label || '…')}</b> · ${esc(s.activity || '')} at ${esc(PLACES[loc].name)} <span class="dim">· updated ${ago(s.updated)}</span>`;
  // panels
  $('#now').innerHTML = `<div><div class="pill">Mood</div><div class="big">${esc(s.mood?.label)}</div><div class="dim small">${esc(s.mood?.why || "")}</div></div>
    <div><div class="pill">Doing</div><div class="big">${esc(s.activity)}</div><div class="dim small">at ${esc(PLACES[loc].name)} · ${esc(s.time_of_day || "")}, ${esc(s.weather || "")}</div></div>
    <div><div class="pill">Feelings</div>${Object.entries(s.needs || {}).map(([k, v]) => bar(k, v)).join("")}</div>`;
  $('#thought').innerHTML = `&ldquo;${esc(s.thought)}&rdquo; <div class="dim small">updated ${ago(s.updated)} · day ${esc(s.day)} of his afterlife</div>`;
  $('#moves').innerHTML = (s.recent_moves || []).slice(0, 8).map(m => `<li><b>${esc(m.t)}</b> ${esc(m.did)}${m.why ? ` <span class="dim">(because: “${esc(m.why)}”)</span>` : ""}</li>`).join("");
  $('#replies').innerHTML = (s.replies || []).slice(0, 8).map(r => `<div class="entry"><div class="dim small">to <b>${esc(r.to)}</b> · ${esc(r.date)}</div><div class="dim">“${esc(r.offering)}”</div><div>${esc(r.reply)}</div></div>`).join("") || `<p class="dim">No letters answered yet. Leave one at the Offering Stone and be the first.</p>`;
  const sh = s.sheet || {}; $('#given').innerHTML = (sh.given || []).map(t => `<li>${esc(t)}</li>`).join("");
  $('#added').innerHTML = (sh.added || []).map(a => `<li class="add">+ ${esc(a.text)} <span class="dim small">(night of ${esc(a.date)})</span></li>`).join("");
  if (typeof window.renderMemories === 'function') try { window.renderMemories(s); } catch (e) {}
  const me = localStorage.getItem("graves_visitor");
  if (me){ const v = (s.visitors || {})[me.toLowerCase()]; const w = $('#welcome'); w.hidden = false;
    w.innerHTML = v ? `<h2>Graves remembers you, ${esc(me)}</h2><p>${esc(v.greeting || "Oh! You came back.")}</p>` : `<h2>Welcome back, ${esc(me)}</h2><p class="dim">Graves hasn't read your offering yet. He reads them about once a day.</p>`;
    const n = document.querySelector("[name=name]"); if (n && !n.value) n.value = me; }
  updateTravel();
}
async function refresh(){ try { const s = await window.loadState(); applyState(s); } catch (e) { console.warn('state', e); } }

/* ---------- speech ---------- */
function gravesLine(){
  if (!STATE) return "…";
  if (graves.sleeping) return "Zzz… (he's asleep in the crypt; he'll read offerings when he wakes)";
  const me = localStorage.getItem("graves_visitor"), v = me && (STATE.visitors || {})[me.toLowerCase()];
  if (v && wisp.position.distanceTo(G.root.position) < 4) return v.greeting || `Oh, ${me}. You came back.`;
  return short(STATE.thought, 170);
}

/* ---------- HUD: travel buttons, prompt, panels ---------- */
let nearPlace = null, nearLandmark = null, openPanel = null, fieldNoteReturnToAtlas = false;
function updateTravel(){
  $('#travel').innerHTML = KEYS.map(k => `<button data-go="${k}" class="${STATE && STATE.location === k ? 'here' : ''}" title="${STATE && STATE.location === k ? 'Graves is here' : ''}">${STATE && STATE.location === k ? '💀 ' : ''}${PLACES[k].name.replace('The ', '')}</button>`).join('') + '<button data-atlas="true" title="Open your private underworld atlas">🗺 Atlas</button>';
}
$('#travel').addEventListener('click', e => { const button = e.target.closest('button'); if (button?.dataset.atlas){ show('atlas'); return; } const k = button?.dataset.go; if (k){ goTo(PLACES[k].ring.clone(), k); } });
let pendingOpen = null;
function goTo(v, openKey){ moveTarget.copy(v); hasTarget = true; marker.visible = true; marker.position.set(v.x, .07, v.z); pendingOpen = openKey || null; audio.chime(); }
function show(id){ closeAll(); const p = document.getElementById(id); if (!p) return; p.hidden = false; openPanel = id; if (id === 'atlas') renderAtlas(); if (id === 'p-ledger_shop' && !$('#shop').children.length && window.renderShop) window.renderShop(); }
function closeAll(){ document.querySelectorAll('.panel').forEach(p => p.hidden = true); openPanel = null; }
document.querySelectorAll('.panel').forEach(p => p.addEventListener('click', e => { if (e.target === p || e.target.classList.contains('x') || e.target.classList.contains('go')) closeAll(); }));
$('#promptb').addEventListener('click', () => { if (nearPlace) show('p-' + nearPlace); else if (nearLandmark) inspectLandmark(nearLandmark); });
$('#helpb').addEventListener('click', () => show('help'));
$('#atlas-clear-waymark').addEventListener('click', () => { activeWaypoint = null; try { localStorage.removeItem(WORLD_WAYPOINT_KEY); } catch {} updateCompass(); renderAtlas(); toast('Waymark cleared'); });
$('#field-note-close').addEventListener('click', () => { if (fieldNoteReturnToAtlas){ fieldNoteReturnToAtlas = false; show('atlas'); } else closeAll(); });
$('#atlas-landmarks').addEventListener('click', e => { const read = e.target.closest('button[data-inscription]'); if (read){ const landmark = resolveLandmarkId(read.dataset.inscription); if (landmark) inspectLandmark(landmark, true); return; } const button = e.target.closest('button[data-waymark]'); if (!button) return; const target = resolveLandmarkId(button.dataset.waymark); if (!target) return; activeWaypoint = target; try { localStorage.setItem(WORLD_WAYPOINT_KEY, target.id); } catch {} closeAll(); updateCompass(); toast('Waymark set · ' + target.name); });
$('#qual').addEventListener('click', () => { QUALITY = (QUALITY + 1) % 3; renderScale = 1; localStorage.setItem('g3d_q', QUALITY); applyQuality(); toast(['Graphics: low (fast)', 'Graphics: medium', 'Graphics: high'][QUALITY]); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); const focus = document.activeElement; if ((e.key === 'e' || e.key === 'Enter') && !openPanel && !focus.closest('button,a,input,textarea,select') && !/INPUT|TEXTAREA/.test(focus.tagName)){ if (nearPlace) show('p-' + nearPlace); else if (nearLandmark) inspectLandmark(nearLandmark); } });
let toastT; function toast(t){ const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2200); }
const labelEls = {}; for (const k of KEYS){ const d = document.createElement('div'); d.className = 'plabel'; d.textContent = PLACES[k].name; $('#labels').appendChild(d); labelEls[k] = d; }

/* ---------- ambient audio (generated with WebAudio, no files) ---------- */
const audio = (() => {
  let ctx = null, master = null, on = false, chimeT = null;
  function start(){
    ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++){ last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 300; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    const wg = ctx.createGain(); wg.gain.value = .5; wind.connect(wf); wf.connect(wg); wg.connect(master); wind.start();
    for (const [f, g] of [[55, .05], [82.4, .03], [110.3, .015]]){ const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.value = g; o.connect(og); og.connect(master); o.start(); }
  }
  function note(f, t0, dur = 2.5, vol = .06){ const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur); }
  function chimeLoop(){ if (!on) return; const sc = [392, 466, 523, 587, 698, 784]; note(sc[Math.random() * sc.length | 0], ctx.currentTime, 3, .03); chimeT = setTimeout(chimeLoop, 3000 + Math.random() * 6000); }
  return {
    toggle(){ if (!ctx) start(); on = !on; ctx.resume(); master.gain.setTargetAtTime(on ? .5 : 0, ctx.currentTime, .4); clearTimeout(chimeT); if (on) chimeLoop(); return on; },
    chime(){ if (on && ctx) note(784, ctx.currentTime, 1, .04); },
    open(){ if (on && ctx){ note(523, ctx.currentTime, 1.5, .05); note(784, ctx.currentTime + .12, 1.5, .04); } },
  };
})();

$('#snd').addEventListener('click', () => { const on = audio.toggle(); $('#snd').textContent = on ? '🔊' : '🔇'; toast(on ? 'Ambient sound on' : 'Sound off'); });

/* ---------- private in-world conversation with the local Graves brain ---------- */
const chatMessages = [];
const brainBase = () => (localStorage.getItem('graves_brain_url') || 'http://127.0.0.1:8787').replace(/\/$/, '');
const chatStatus = $('#chat-status'), chatList = $('#chat-messages'), chatInput = $('#chat-input');
function setChatStatus(message, kind=''){ chatStatus.textContent=message; chatStatus.className='chat-status'+(kind?' '+kind:''); }
function addChatMessage(role, content){
  const empty=chatList.querySelector('.chat-empty'); if(empty) empty.remove();
  const item=document.createElement('div'); item.className='chat-message '+(role==='assistant'?'graves':'operator');
  const who=document.createElement('span'); who.className='speaker'; who.textContent=role==='assistant'?'Graves':'You';
  const body=document.createElement('span'); body.textContent=content;
  item.append(who,body); chatList.appendChild(item); chatList.scrollTop=chatList.scrollHeight;
}
function worldContext(){return {place:nearPlace?PLACES[nearPlace].name:null,location:STATE?.location||null,mood:STATE?.mood?.label||null,activity:STATE?.activity||null,thought:short(STATE?.thought||'',260),day:STATE?.day||null};}
async function checkBrain(){
  setChatStatus('Looking for the local AI brain…');
  try{const r=await fetch(brainBase()+'/api/health',{cache:'no-store'});if(!r.ok)throw new Error('Local bridge returned '+r.status);const data=await r.json();if(!data.connected)throw new Error(data.message||'Ollama is not responding.');setChatStatus('Connected · '+data.model+' · replies run on this computer','connected');}
  catch(e){setChatStatus('Not connected. Start Ollama and the Graves local bridge on this computer. Setup guide below. ('+short(e.message,110)+')','error');}
}
$('#talkb').addEventListener('click',()=>{show('p-conversation');checkBrain();setTimeout(()=>chatInput.focus(),120);});
$('#chat-form').addEventListener('submit',async e=>{
  e.preventDefault();const message=chatInput.value.trim();if(!message)return;
  const send=$('#chat-send');chatInput.value='';chatMessages.push({role:'user',content:message});addChatMessage('user',message);send.disabled=true;setChatStatus('Graves is gathering his thoughts…');
  try{const r=await fetch(brainBase()+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatMessages.slice(-12),world:worldContext()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'The local mind could not answer.');const reply=String(data.reply||'The lantern flickers, but no words came through.').slice(0,5000);chatMessages.push({role:'assistant',content:reply});addChatMessage('assistant',reply);setChatStatus('Connected · '+(data.model||'local model'),'connected');$('#proposal-button').disabled=false;}
  catch(err){chatMessages.pop();chatInput.value=message;setChatStatus(err.message+' Check the local bridge and try again.','error');}
  finally{send.disabled=false;chatInput.focus();}
});
chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chat-form').requestSubmit();}});
$('#chat-clear').addEventListener('click',()=>{chatMessages.length=0;chatList.innerHTML='<div class="chat-empty">The lantern is waiting. Start us off.</div>';$('#proposal-button').disabled=true;$('#proposal-result').hidden=true;setChatStatus('Conversation cleared. This session was not saved.');});
$('#proposal-button').addEventListener('click',async()=>{
  if(!chatMessages.length)return;const button=$('#proposal-button');button.disabled=true;button.textContent='Drafting proposal…';
  try{const r=await fetch(brainBase()+'/api/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatMessages.slice(-12),world:worldContext()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not create a proposal.');const p=data.proposal,box=$('#proposal-result');box.hidden=false;box.replaceChildren();const title=document.createElement('h3');title.textContent='Proposal saved to your private vault';const name=document.createElement('p');name.textContent=p.title+' · '+p.kind;const summary=document.createElement('p');summary.textContent=p.summary;const details=document.createElement('p');details.textContent=(p.design_notes||[]).join(' • ');const status=document.createElement('p');status.textContent='Review required · Not applied to the world';box.append(title,name,summary,details,status);setChatStatus('Proposal saved locally for review. Nothing has been published.','connected');}
  catch(err){setChatStatus(err.message,'error');}
  finally{button.disabled=false;button.textContent='✧ Turn this conversation into a build proposal';}
});


/* ---------- input: tap/click to move, drag to orbit, pinch/scroll zoom, WASD ---------- */
const cam = { yaw: 0.0, pitch: MOBILE ? .55 : 0.42, dist: MOBILE ? 15 : 12, look: new THREE.Vector3() };
const keys = {}; addEventListener('keydown', e => { if (!/INPUT|TEXTAREA/.test(document.activeElement.tagName)) keys[e.key.toLowerCase()] = true; }); addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
const pointers = new Map(); let drag = null, pinch0 = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0 }; else { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = null; } });
canvas.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; const p = pointers.get(e.pointerId);
  if (pointers.size === 2){ p.x = e.clientX; p.y = e.clientY; const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0){ cam.dist = clamp(cam.dist * pinch0 / d, 6, 24); } pinch0 = d; return; }
  if (drag){ const dx = e.clientX - p.x, dy = e.clientY - p.y; drag.moved += Math.abs(dx) + Math.abs(dy); if (drag.moved > 8){ cam.yaw -= dx * .006; cam.pitch = clamp(cam.pitch + dy * .004, .15, 1.1); } }
  p.x = e.clientX; p.y = e.clientY; });
const endPtr = e => { const wasTap = drag && drag.moved <= 8 && pointers.size === 1; pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0;
  if (wasTap){ ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    // tapped Graves?
    if (ray.intersectObject(G.root, true).length){ goTo(G.root.position.clone().add(new THREE.Vector3(0, 0, 2.2))); toast('Drifting over to Graves'); }
    else { const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, hit)){ let k = null; for (const q of KEYS) if (hit.distanceTo(PLACES[q].pos) < 4.5) k = q; goTo(hit.clone().sub(wisp.position).clampLength(0, 120).add(wisp.position), null); if (k) pendingOpen = null; } } }
  drag = null; };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * .08), 6, 24); e.preventDefault(); }, { passive: false });

/* ---------- simulation ---------- */
function collide(v, r = .4){ for (const s of solids){ const dx = v.x - s.x, dz = v.z - s.z, d = Math.hypot(dx, dz), m = s.r + r; if (d < m && d > 1e-4){ v.x = s.x + dx / d * m; v.z = s.z + dz / d * m; } } }
const generatedChunks = new Map();
let currentChunkKey = '', currentBiomeId = '', enteredUndercroft = false;
const WORLD_POSITION_KEY = 'g3d_world_position';
const DISCOVERED_LANDMARKS_KEY = 'g3d_discovered_landmarks';
const DISCOVERED_BIOMES_KEY = 'g3d_discovered_biomes';
const WORLD_WAYPOINT_KEY = 'g3d_world_waypoint';
const chunkQueue = [], pendingChunkKeys = new Set();
let activeWaypoint = null;
function chunkKey(x, z){ return x + ',' + z; }
function addChunkLandmark(root, landmark, x, y, z, accent, key){
  const model = new THREE.Group();
  model.position.set(x, y, z);
  model.rotation.y = landmark.variant * Math.PI / 4;
  model.scale.setScalar(.94 + (landmark.variant % 4) * .04);
  root.add(model);
  add(new THREE.CylinderGeometry(2.05, 2.35, .35, 9), MAT.stoneDark, 0, .18, 0, model);
  if (landmark.type === 'resonance-spire'){
    add(new THREE.CylinderGeometry(.52, .85, 4.8, 7), MAT.stone, 0, 2.65, 0, model);
    add(new THREE.ConeGeometry(.68, 2.2, 7), accent, 0, 5.9, 0, model);
    const halo = add(new THREE.TorusGeometry(1.35, .075, 6, 18), accent, 0, 4.1, 0, model); halo.rotation.x = Math.PI / 2;
  } else if (landmark.type === 'shattered-gate'){
    for (const side of [-1, 1]){
      add(new THREE.BoxGeometry(.72, 3.4, .75), MAT.stone, side * 2, 1.9, 0, model);
      add(new THREE.BoxGeometry(.95, .35, .92), MAT.stoneDark, side * 2, 3.75, 0, model);
    }
    add(new THREE.BoxGeometry(4.6, .62, .82), MAT.stoneDark, 0, 4.15, 0, model).rotation.z = .08;
    add(new THREE.OctahedronGeometry(.42, 0), accent, 0, 2.65, 0, model);
  } else if (landmark.type === 'bone-crown'){
    for (let i = 0; i < 7; i++){
      const angle = i * Math.PI * 2 / 7, px = Math.cos(angle) * 1.55, pz = Math.sin(angle) * 1.55;
      const rib = add(new THREE.CylinderGeometry(.14, .27, 3.2, 6), MAT.bone, px, 1.8, pz, model); rib.rotation.z = -Math.cos(angle) * .32; rib.rotation.x = Math.sin(angle) * .32;
      add(new THREE.SphereGeometry(.2, 6, 5), MAT.bone, px * 1.15, 3.4, pz * 1.15, model);
    }
    add(new THREE.OctahedronGeometry(.65, 0), accent, 0, 2.7, 0, model);
  } else if (landmark.type === 'drowned-bell'){
    add(new THREE.CylinderGeometry(.28, .52, 4.6, 8), MAT.bark, 0, 2.55, 0, model);
    const cap = add(new THREE.SphereGeometry(1.25, 10, 7), accent, 0, 4.75, 0, model); cap.scale.y = .58;
    add(new THREE.TorusGeometry(1.4, .11, 6, 16), MAT.paper, 0, 4.2, 0, model).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(.34, 8, 6), MAT.lamp, 0, 3.35, 0, model);
  } else if (landmark.type === 'archive-relay'){
    for (let i = 0; i < 4; i++){
      const angle = i * Math.PI / 2, px = Math.cos(angle) * 1.8, pz = Math.sin(angle) * 1.8;
      add(new THREE.CylinderGeometry(.25, .4, 3.5, 7), MAT.stone, px, 1.95, pz, model);
    }
    const halo = add(new THREE.TorusGeometry(1.25, .09, 6, 20), accent, 0, 3.15, 0, model); halo.rotation.x = Math.PI / 2;
    add(new THREE.OctahedronGeometry(.58, 0), accent, 0, 3.1, 0, model);
    add(new THREE.BoxGeometry(4.4, .26, .42), MAT.stoneDark, 0, 3.8, 0, model);
  } else if (landmark.type === 'blackwater-well'){
    for (let i = 0; i < 10; i++){
      const angle = i * Math.PI * 2 / 10, px = Math.cos(angle) * 1.45, pz = Math.sin(angle) * 1.45;
      add(new THREE.BoxGeometry(.58, .7, .55), MAT.stoneDark, px, .52, pz, model).rotation.y = angle;
    }
    add(new THREE.CylinderGeometry(1.12, 1.25, .12, 16), accent, 0, .58, 0, model);
    const eye = add(new THREE.SphereGeometry(.5, 9, 7), accent, 0, 1.35, 0, model); eye.scale.y = 1.5;
  } else if (landmark.type === 'mothlight-grove'){
    for (let i = 0; i < 5; i++){
      const angle = i * Math.PI * 2 / 5, px = Math.cos(angle) * 1.5, pz = Math.sin(angle) * 1.5, h = 2.5 + (i % 2) * .8;
      add(new THREE.CylinderGeometry(.13, .22, h, 6), MAT.bark, px, h / 2 + .25, pz, model);
      const bloom = add(new THREE.SphereGeometry(.45 + (i % 2) * .12, 8, 6), i % 2 ? MAT.pink : accent, px, h + .35, pz, model); bloom.scale.y = .55;
    }
    add(new THREE.OctahedronGeometry(.48, 0), MAT.lamp, 0, 2.2, 0, model);
  } else {
    for (let i = -1; i <= 1; i++){
      const marker = add(new THREE.BoxGeometry(.8, 2.7 + (i === 0 ? 1 : 0), .48), MAT.stone, i * 1.25, 1.55 + (i === 0 ? .5 : 0), 0, model);
      marker.rotation.z = i * .05;
      add(new THREE.ConeGeometry(.44, .65, 4), MAT.stoneDark, i * 1.25, 3.1 + (i === 0 ? 1 : 0), 0, model).rotation.y = Math.PI / 4;
      add(new THREE.SphereGeometry(.12, 7, 5), accent, i * 1.25, 2.25, .27, model);
    }
  }
  solids.push({x,z,r:2.4,chunkKey:key});
}
function addUndercroftChunk(chunkX, chunkZ){
  const key = chunkKey(chunkX, chunkZ), root = new THREE.Group();
  root.name = 'generated-undercroft-' + key; scene.add(root);
  const biome = biomeForChunk(chunkX, chunkZ), random = createChunkRandom(chunkX, chunkZ);
  const landmark = landmarkForChunk(chunkX, chunkZ);
  const originX = chunkX * CHUNK_SIZE, originZ = chunkZ * CHUNK_SIZE;
  const ownedMaterials = [];
  const accent = glow(biome.accent, 2.2); ownedMaterials.push(accent);
  // Keep the authored town floor seamless; generated terrain begins outside its four center tiles.
  const isTownFloor = chunkX >= -1 && chunkX <= 0 && chunkZ >= -1 && chunkZ <= 0;
  if (!isTownFloor){
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 12, 12);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position, colors = [], base = new THREE.Color(biome.tint);
    for (let i = 0; i < positions.count; i++){
      const worldX = originX + CHUNK_SIZE / 2 + positions.getX(i), worldZ = originZ + CHUNK_SIZE / 2 + positions.getZ(i);
      positions.setY(i, groundY(worldX, worldZ));
      const shade = base.clone(); shade.offsetHSL((random() - .5) * .025, 0, (random() - .5) * .07);
      colors.push(shade.r, shade.g, shade.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const terrainMaterial = M(0xffffff, { vertexColors:true, roughness:1, flatShading:true }); ownedMaterials.push(terrainMaterial);
    const terrain = new THREE.Mesh(geometry, terrainMaterial); terrain.position.set(originX + CHUNK_SIZE / 2, 0, originZ + CHUNK_SIZE / 2); terrain.receiveShadow = true; root.add(terrain);
  }
  const clusters = 4 + Math.floor(random() * 3);
  for (let n = 0; n < clusters; n++){
    const x = originX + 4 + random() * (CHUNK_SIZE - 8), z = originZ + 4 + random() * (CHUNK_SIZE - 8);
    if (Math.hypot(x, z) < 56) continue;
    const y = groundY(x, z);
    if (biome.form === 'crystal'){
      for (let shard = 0; shard < 3 + Math.floor(random() * 2); shard++){
        const height = .8 + random() * 1.5, geo = new THREE.ConeGeometry(.22 + random() * .22, height, 5);
        const mesh = add(geo, accent, x + (random() - .5) * .9, y + height / 2, z + (random() - .5) * .9, root); mesh.rotation.z = (random() - .5) * .5;
      }
    } else if (biome.form === 'stone'){
      for (let rock = 0; rock < 3; rock++){
        const size = .45 + random() * .8, mesh = add(new THREE.IcosahedronGeometry(size, 0), rock % 2 ? MAT.stone : MAT.stoneDark, x + (random() - .5) * 1.4, y + size * .55, z + (random() - .5) * 1.4, root);
        mesh.rotation.set(random(), random() * 3, random()); mesh.scale.y = .65 + random() * .45;
      }
    } else if (biome.form === 'bone'){
      add(new THREE.CylinderGeometry(.16, .32, 3.2, 6), MAT.bone, x, y + 1.6, z, root).rotation.z = (random() - .5) * .18;
      const branch = add(new THREE.BoxGeometry(1.8, .13, .13), MAT.bone, x, y + 2.55, z, root); branch.rotation.y = random() * Math.PI;
      add(new THREE.SphereGeometry(.24, 6, 5), MAT.bone, x - .5, y + 3, z, root); add(new THREE.SphereGeometry(.24, 6, 5), MAT.bone, x + .5, y + 3, z, root);
    } else if (biome.form === 'fungus'){
      const height = .7 + random() * .55;
      add(new THREE.CylinderGeometry(.12, .2, height, 6), MAT.paper, x, y + height / 2, z, root);
      const cap = add(new THREE.SphereGeometry(.48 + random() * .28, 8, 5), random() > .5 ? MAT.pink : MAT.lilac, x, y + height, z, root); cap.scale.y = .55;
      add(new THREE.SphereGeometry(.07, 6, 4), accent, x + .12, y + height * 1.4, z + .28, root);
    } else if (biome.form === 'basalt'){
      for (let rock = 0; rock < 4; rock++){
        const height = .8 + random() * 2, px = x + (random() - .5) * 1.7, pz = z + (random() - .5) * 1.7;
        const pillar = add(new THREE.CylinderGeometry(.25 + random() * .2, .45 + random() * .25, height, 5), MAT.stoneDark, px, y + height / 2, pz, root);
        pillar.rotation.z = (random() - .5) * .24;
      }
      add(new THREE.OctahedronGeometry(.22, 0), accent, x, y + 2.2, z, root);
    } else if (biome.form === 'moth'){
      const height = 1.4 + random() * 1.3;
      add(new THREE.CylinderGeometry(.08, .16, height, 5), MAT.bark, x, y + height / 2, z, root);
      const bloom = add(new THREE.SphereGeometry(.44 + random() * .22, 8, 6), random() > .5 ? MAT.pink : accent, x, y + height, z, root); bloom.scale.y = .5;
      for (let mote = 0; mote < 3; mote++) add(new THREE.SphereGeometry(.08, 6, 5), accent, x + (random() - .5) * 1.1, y + height + .35 + random() * .55, z + (random() - .5) * 1.1, root);
    } else if (biome.form === 'ward'){
      for (let marker = 0; marker < 3; marker++){
        const px = x + (marker - 1) * .8, height = 1.5 + random() * 1.1;
        add(new THREE.BoxGeometry(.56, height, .32), MAT.stone, px, y + height / 2, z, root);
        add(new THREE.ConeGeometry(.36, .5, 4), MAT.stoneDark, px, y + height + .18, z, root).rotation.y = Math.PI / 4;
        add(new THREE.SphereGeometry(.08, 6, 5), accent, px, y + height * .62, z + .19, root);
      }
    } else {
      for (let pillar = 0; pillar < 3; pillar++){
        const angle = pillar * Math.PI * 2 / 3, px = x + Math.cos(angle) * 1.5, pz = z + Math.sin(angle) * 1.5;
        add(new THREE.CylinderGeometry(.22, .32, 3.1, 7), MAT.stone, px, y + 1.55, pz, root);
      }
      add(new THREE.BoxGeometry(3.8, .28, .45), MAT.stoneDark, x, y + 3.05, z, root);
      add(new THREE.OctahedronGeometry(.35, 0), accent, x, y + 3.65, z, root);
    }
    solids.push({ x, z, r: biome.form === 'ruins' ? 1.4 : 1, chunkKey:key });
  }
  if (landmark) addChunkLandmark(root, landmark, (chunkX + .5) * CHUNK_SIZE, groundY((chunkX + .5) * CHUNK_SIZE, (chunkZ + .5) * CHUNK_SIZE), (chunkZ + .5) * CHUNK_SIZE, accent, key);
  root.userData.ownedMaterials = ownedMaterials;
  const chunk = {x:chunkX, z:chunkZ, root, biome, landmark};
  generatedChunks.set(key, chunk);
  if (key === currentChunkKey) announceLandmark(chunk);
}
function removeUndercroftChunk(key, chunk){
  scene.remove(chunk.root);
  chunk.root.traverse(object => { if (object.geometry) object.geometry.dispose(); });
  chunk.root.userData.ownedMaterials.forEach(material => material.dispose());
  for (let i = solids.length - 1; i >= 0; i--) if (solids[i].chunkKey === key) solids.splice(i, 1);
  generatedChunks.delete(key);
}
function readStoredIds(key){
  try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []; } catch { return []; }
}
function resolveLandmarkId(id){
  const match = /^(-?\d+):(-?\d+)$/.exec(String(id || ''));
  if (!match) return null;
  const cellX = Number(match[1]), cellZ = Number(match[2]);
  if (!Number.isSafeInteger(cellX) || !Number.isSafeInteger(cellZ)) return null;
  const landmark = landmarkForCell(cellX, cellZ);
  return landmark?.id === id ? landmark : null;
}
function rememberBiome(biome){
  if (SHOT) return;
  const seen = readStoredIds(DISCOVERED_BIOMES_KEY);
  if (seen.includes(biome.id)) return;
  seen.push(biome.id);
  try { localStorage.setItem(DISCOVERED_BIOMES_KEY, JSON.stringify(seen)); } catch {}
}
function announceLandmark(chunk){
  if (!chunk?.landmark || SHOT) return;
  const seen = readStoredIds(DISCOVERED_LANDMARKS_KEY);
  if (seen.includes(chunk.landmark.id)) return;
  seen.push(chunk.landmark.id);
  try { localStorage.setItem(DISCOVERED_LANDMARKS_KEY, JSON.stringify(seen.slice(-256))); } catch {}
  toast('Discovered ' + chunk.landmark.name + ' · ' + chunk.biome.name);
}
function renderAtlas(){
  const biomes = $('#atlas-biomes'), landmarks = $('#atlas-landmarks');
  const knownBiomes = new Set(readStoredIds(DISCOVERED_BIOMES_KEY));
  const ids = [...new Set(readStoredIds(DISCOVERED_LANDMARKS_KEY))];
  const sites = ids.map(resolveLandmarkId).filter(Boolean);
  const activeId = activeWaypoint?.id || null;
  $('#atlas-progress').textContent = knownBiomes.size + ' of ' + UNDERWORLD_BIOMES.length + ' regions · ' + sites.length + ' landmarks mapped';
  const biomeList = document.createDocumentFragment();
  for (const biome of UNDERWORLD_BIOMES){
    if (!knownBiomes.has(biome.id)) continue;
    const item = document.createElement('span'); item.className = 'atlas-biome'; item.textContent = biome.name;
    item.style.setProperty('--biome-accent', biome.accent); biomeList.appendChild(item);
  }
  if (!biomeList.childNodes.length){ const empty = document.createElement('p'); empty.className = 'dim small'; empty.textContent = 'No regions mapped yet. Travel beyond Lantern Road to begin exploring.'; biomeList.appendChild(empty); }
  biomes.replaceChildren(biomeList);
  sites.sort((a,b) => Math.hypot(a.x-wisp.position.x,a.z-wisp.position.z) - Math.hypot(b.x-wisp.position.x,b.z-wisp.position.z));
  const landmarkList = document.createDocumentFragment();
  for (const site of sites){
    const dx = site.x - wisp.position.x, dz = site.z - wisp.position.z, distance = Math.hypot(dx,dz);
    const bearing = (Math.atan2(dx,-dz) * 180 / Math.PI + 360) % 360;
    const direction = COMPASS_SHORT_NAMES[Math.round(bearing / 45) % 8];
    const card = document.createElement('article'); card.className = 'atlas-landmark';
    const title = document.createElement('strong'); title.textContent = site.name;
    const biome = UNDERWORLD_BIOMES.find(item => item.id === site.biomeId);
    const meta = document.createElement('span'); meta.className = 'dim small'; meta.textContent = (biome?.name || 'Unknown region') + ' · ' + direction + ' · ' + Math.round(distance) + ' world units';
    const grid = document.createElement('span'); grid.className = 'dim small'; grid.textContent = 'Grid ' + (site.x >= 0 ? '+' : '') + Math.round(site.x) + ', ' + (site.z >= 0 ? '+' : '') + Math.round(site.z);
    const actions = document.createElement('div'); actions.className = 'atlas-landmark-actions';
    const track = document.createElement('button'); track.type = 'button'; track.dataset.waymark = site.id; track.textContent = activeId === site.id ? 'Tracking' : 'Set direction';
    track.setAttribute('aria-label', (activeId === site.id ? 'Currently tracking ' : 'Set compass direction to ') + site.name);
    const read = document.createElement('button'); read.type = 'button'; read.dataset.inscription = site.id; read.textContent = 'Read inscription';
    read.setAttribute('aria-label', 'Read the inscription at ' + site.name);
    actions.append(track, read);
    card.append(title, meta, grid, actions); landmarkList.appendChild(card);
  }
  if (!sites.length){ const empty = document.createElement('p'); empty.className = 'dim small'; empty.textContent = 'No landmarks mapped yet. Named places will appear here as you find them.'; landmarkList.appendChild(empty); }
  landmarks.replaceChildren(landmarkList);
  $('#atlas-clear-waymark').disabled = !activeWaypoint;
}

function inspectLandmark(landmark, returnToAtlas = false){
  if (!landmark) return;
  fieldNoteReturnToAtlas = returnToAtlas;
  const biome = UNDERWORLD_BIOMES.find(item => item.id === landmark.biomeId);
  $('#field-note-title').textContent = landmark.name;
  $('#field-note-region').textContent = (biome?.name || 'Unknown region') + ' · Grid ' + (landmark.x >= 0 ? '+' : '') + Math.round(landmark.x) + ', ' + (landmark.z >= 0 ? '+' : '') + Math.round(landmark.z);
  $('#field-note-inscription').textContent = landmarkInscriptionFor(landmark);
  show('field-note');
}

function saveWorldPosition(){
  if (SHOT) return;
  try { localStorage.setItem(WORLD_POSITION_KEY, JSON.stringify({x:wisp.position.x, z:wisp.position.z})); } catch {}
}
function loadWorldPosition(){
  if (SHOT) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(WORLD_POSITION_KEY) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.z) && Math.abs(saved.x) < 1000000 && Math.abs(saved.z) < 1000000) return saved;
  } catch {}
  return null;
}
addEventListener('pagehide', saveWorldPosition);
function ensureWorldChunks(){
  const centerX = Math.floor(wisp.position.x / CHUNK_SIZE), centerZ = Math.floor(wisp.position.z / CHUNK_SIZE), centerKey = chunkKey(centerX, centerZ);
  if (centerKey === currentChunkKey) return;
  currentChunkKey = centerKey;
  const retained = chunkQueue.filter(point => Math.abs(point.x - centerX) <= CHUNK_UNLOAD_RADIUS && Math.abs(point.z - centerZ) <= CHUNK_UNLOAD_RADIUS);
  chunkQueue.length = 0; pendingChunkKeys.clear();
  for (const point of retained){ const key = chunkKey(point.x, point.z); if (!generatedChunks.has(key) && !pendingChunkKeys.has(key)){ chunkQueue.push(point); pendingChunkKeys.add(key); } }
  const wanted = chunksAround(wisp.position.x, wisp.position.z, CHUNK_LOAD_RADIUS);
  wanted.sort((a,b) => (a.x-centerX)**2 + (a.z-centerZ)**2 - ((b.x-centerX)**2 + (b.z-centerZ)**2));
  for (const point of wanted){ const key = chunkKey(point.x, point.z); if (!generatedChunks.has(key) && !pendingChunkKeys.has(key)){ chunkQueue.push(point); pendingChunkKeys.add(key); } }
  chunkQueue.sort((a,b) => (a.x-centerX)**2 + (a.z-centerZ)**2 - ((b.x-centerX)**2 + (b.z-centerZ)**2));
  for (const [key, chunk] of generatedChunks){
    if (Math.abs(chunk.x - centerX) > CHUNK_UNLOAD_RADIUS || Math.abs(chunk.z - centerZ) > CHUNK_UNLOAD_RADIUS) removeUndercroftChunk(key, chunk);
  }
  const biome = biomeForChunk(centerX, centerZ);
  const radius = Math.hypot(wisp.position.x, wisp.position.z);
  if (radius > 58){ rememberBiome(biome); if (!enteredUndercroft){ toast('The lantern road opens into ' + biome.name); enteredUndercroft = true; } else if (currentBiomeId !== biome.id) toast('Entered ' + biome.name); }
  currentBiomeId = biome.id;
  announceLandmark(generatedChunks.get(centerKey));
  saveWorldPosition();
}
function processChunkQueue(){
  const centerX = Math.floor(wisp.position.x / CHUNK_SIZE), centerZ = Math.floor(wisp.position.z / CHUNK_SIZE);
  let built = 0;
  while (chunkQueue.length && built < 2){
    const point = chunkQueue.shift(), key = chunkKey(point.x, point.z);
    pendingChunkKeys.delete(key);
    if (generatedChunks.has(key) || Math.abs(point.x-centerX) > CHUNK_UNLOAD_RADIUS || Math.abs(point.z-centerZ) > CHUNK_UNLOAD_RADIUS) continue;
    addUndercroftChunk(point.x, point.z); built++;
  }
}
const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
function stepWisp(dt){
  let ix = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0), iz = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
  const speed = 8;
  if (ix || iz){ hasTarget = false; marker.visible = false; pendingOpen = null; const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw); tmp.set(ix * c + iz * s, 0, -ix * s + iz * c).normalize().multiplyScalar(speed * dt); wisp.position.add(tmp); }
  else if (hasTarget){ tmp.copy(moveTarget).sub(wisp.position); tmp.y = 0; const d = tmp.length(); if (d < .3){ hasTarget = false; marker.visible = false; if (pendingOpen){ show('p-' + pendingOpen); audio.open(); pendingOpen = null; } } else wisp.position.add(tmp.multiplyScalar(Math.min(1, speed * dt / d))); }
  collide(wisp.position, .35);
  wisp.position.y = groundY(wisp.position.x, wisp.position.z) + 1.1 + Math.sin(T * 2.2) * .12;
  for (let i = TRAIL - 1; i > 0; i--){ trailPos[i * 3] = trailPos[(i - 1) * 3]; trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1] + .01; trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2]; }
  trailPos[0] = wisp.position.x + (Math.random() - .5) * .1; trailPos[1] = wisp.position.y; trailPos[2] = wisp.position.z + (Math.random() - .5) * .1; trailGeo.attributes.position.needsUpdate = true;
  whalo.material.opacity = .4 + Math.sin(T * 5) * .1;
  // Places take priority; otherwise offer an inspection when a generated landmark is close.
  let near = null; for (const k of KEYS){ const r = PLACES[k].ring; if (Math.hypot(wisp.position.x - r.x, wisp.position.z - r.z) < 2.1) near = k; }
  let site = null, siteDistance = 6;
  if (!near) for (const chunk of generatedChunks.values()){
    const landmark = chunk.landmark; if (!landmark) continue;
    const distance = Math.hypot(wisp.position.x - landmark.x, wisp.position.z - landmark.z);
    if (distance < siteDistance){ site = landmark; siteDistance = distance; }
  }
  if (near !== nearPlace || site?.id !== nearLandmark?.id){
    nearPlace = near; nearLandmark = site;
    $('#prompt').hidden = !near && !site;
    if (near) $('#promptb').textContent = `✦ ${PLACES[near].open}`;
    else if (site) $('#promptb').textContent = `✦ Inspect ${site.name}`;
    if (near || site) audio.chime();
  }
}
function stepGraves(dt){
  const home = PLACES[graves.home], p = G.root.position;
  if (graves.sleeping){ graves.target.copy(PLACES.crypt.stand); }
  else if (!graves.walking && (graves.wait -= dt) <= 0){
    const far = p.distanceTo(home.stand) > 4.5;
    graves.target.copy(home.stand); if (!far){ const a = Math.random() * Math.PI * 2, r = .6 + Math.random() * 2.4; graves.target.x += Math.cos(a) * r; graves.target.z += Math.sin(a) * r; collide(graves.target, .6); }
    graves.walking = true;
  }
  tmp.copy(graves.target).sub(p); tmp.y = 0; const d = tmp.length();
  const visitorNear = wisp.position.distanceTo(p) < 4;
  if (d > .15 && !(visitorNear && !graves.sleeping && d < 5)){
    graves.walking = true; p.add(tmp.multiplyScalar(Math.min(1, graves.speed * dt / d))); collide(p, .6);
    graves.facing = Math.atan2(graves.target.x - p.x, graves.target.z - p.z);
  } else { if (graves.walking){ graves.walking = false; graves.wait = 4 + Math.random() * 6; }
    if (visitorNear) graves.facing = Math.atan2(wisp.position.x - p.x, wisp.position.z - p.z);
    else if (!graves.sleeping) graves.facing += Math.sin(T * .3) * .002; }
  let dy = graves.facing - G.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); G.root.rotation.y += dy * Math.min(1, dt * 6);
  // animation: floaty glide when walking, breathing idle, sleepy slump
  const w = graves.walking ? 1 : 0; G._w = lerp(G._w || 0, w, Math.min(1, dt * 5)); const W = G._w;
  p.y = groundY(p.x, p.z) + .08 + Math.abs(Math.sin(T * 7)) * .12 * W + Math.sin(T * 1.6) * .04 * (1 - W);
  G.body.rotation.x = .18 * W + (graves.sleeping ? .25 : 0); G.body.rotation.z = Math.sin(T * 7) * .06 * W;
  G.robe.scale.set(1 + Math.sin(T * 1.6) * .02, 1 - Math.sin(T * 1.6) * .02 + Math.sin(T * 14) * .02 * W, 1);
  G.armR.rotation.x = Math.sin(T * 7) * .45 * W - .15; G.armL.rotation.x = -Math.sin(T * 7) * .45 * W - .3 + Math.sin(T * 1.6) * .05;
  G.crystal.rotation.y += dt * 2; G.crystal.position.y = 1.72 + Math.sin(T * 3) * .04;
  const blink = (T % 4.3) < .12 ? .1 : 1; const ek = graves.sleeping ? .08 : 1; G.eyes.forEach(e => e.scale.y = 1.35 * blink * (graves.sleeping ? .2 : 1)); G.eyeLight.intensity = 2.5 * ek;
  G.lantLight.intensity = 2.2 + Math.sin(T * 13) * .3;
}
const proj = new THREE.Vector3();
function toScreen(v, el, yOff = 0, maxD = 40){ proj.copy(v); proj.y += yOff; const dist = camera.position.distanceTo(proj); proj.project(camera);
  const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 && dist < maxD; el.hidden = !vis; if (vis){ el.style.left = ((proj.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - proj.y) / 2 * innerHeight) + 'px'; } return vis; }

let T = 0, last = performance.now(), frames = 0, slowFrames = 0, rafId = 0;
function updateCompass(){
  const bearing = ((-cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const index = Math.round(bearing / 45) % 8;
  const rose = $('#compass-rose'); if (rose) rose.style.transform = 'rotate(' + cam.yaw + 'rad)';
  const heading = $('#compass'), label = $('#heading');
  const shortName = COMPASS_SHORT_NAMES[index], degrees = Math.round(bearing);
  if (heading && heading._lastHeading !== shortName + ' ' + degrees + '°'){ heading._lastHeading = shortName + ' ' + degrees + '°'; heading.setAttribute('aria-label', 'Compass. Facing ' + HEADING_NAMES[index] + ', ' + degrees + ' degrees.'); if (label) label.textContent = heading._lastHeading; }
  const marker = $('#waypoint-marker'), caption = $('#waypoint-label');
  if (!activeWaypoint){ if (marker) marker.hidden = true; if (caption) caption.hidden = true; return; }
  const dx = activeWaypoint.x - wisp.position.x, dz = activeWaypoint.z - wisp.position.z, distance = Math.hypot(dx,dz);
  const targetBearing = (Math.atan2(dx,-dz) * 180 / Math.PI + 360) % 360, relative = (targetBearing - bearing + 360) % 360;
  if (marker){ marker.hidden = false; marker.style.transform = 'rotate(' + relative + 'deg) translateY(-21px)'; }
  if (caption){ const direction = COMPASS_SHORT_NAMES[Math.round(targetBearing / 45) % 8]; const text = activeWaypoint.name + ' · ' + direction + ' · ' + Math.round(distance) + ' units'; if (caption._lastText !== text){ caption.textContent = text; caption._lastText = text; } caption.hidden = false; }
}
function frame(now){
  rafId = 0;
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  if (!openPanel){ stepWisp(dt); }
  stepGraves(dt);
  ensureWorldChunks();
  processChunkQueue();
  sky.position.copy(wisp.position); stars.position.set(wisp.position.x, 0, wisp.position.z);
  moon.position.set(wisp.position.x + Math.cos(moonAngle) * 150, 40 + Math.abs(Math.sin(moonAngle)) * 60, wisp.position.z - 120);
  // camera follows the wisp
  cam.look.lerp(tmp.copy(wisp.position).setY(wisp.position.y + .3), Math.min(1, dt * 5));
  const cx = cam.look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = cam.look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  camera.position.lerp(tmp.set(cx, Math.max(cam.look.y + Math.sin(cam.pitch) * cam.dist, groundY(cx, cz) + 1.2), cz), Math.min(1, dt * 6)); camera.lookAt(cam.look); updateCompass();
  // lights flicker; lamps brighter at night
  for (const f of flickers){ f.light.intensity = f.base * PALNOW.lamps * (0.85 + Math.sin(T * 9 + f.ph) * .07 + Math.sin(T * 23 + f.ph * 2) * .05); }
  MAT.lamp.emissiveIntensity = 1.4 + PALNOW.lamps * 1.2;
  ffMat.opacity = .35 + PALNOW.lamps * .5;
  for (let i = 0; i < FF; i++){ const s = ffSeed[i]; ffPos[i * 3] += Math.sin(T * .7 + s) * dt * .8; ffPos[i * 3 + 1] = 1 + Math.sin(T * .9 + s * 1.3) * 1.2 + (s % 3); ffPos[i * 3 + 2] += Math.cos(T * .6 + s * .7) * dt * .8; }
  ffGeo.attributes.position.needsUpdate = true;
  for (let i = 0; i < EM; i++){ const e = emitters[i % 3]; emPos[i * 3 + 1] += dt * (.6 + emV[i]); emPos[i * 3] += Math.sin(T * 2 + i) * dt * .3; if (emPos[i * 3 + 1] > e.y + 4){ emPos[i * 3] = e.x + (Math.random() - .5) * .4; emPos[i * 3 + 1] = e.y; emPos[i * 3 + 2] = e.z + (Math.random() - .5) * .4; } }
  emGeo.attributes.position.needsUpdate = true;
  for (const m of mists){ m.s.position.x += m.v * dt; if (m.s.position.x > 35) m.s.position.x = -35; }
  for (const f of flowers){ f.m.position.y = f.y + Math.sin(T * 1.5 + f.ph) * .04; }
  for (const b of libraryMotes){ b.book.rotation.y = Math.sin(T*.65+b.phase)*.35; b.book.position.y = 8.9 + Math.sin(T*.8+b.phase)*.32; }
  for (const k of KEYS){ const r = rings[k]; const here = STATE && STATE.location === k; r.material.opacity = (k === nearPlace ? .9 : .35 + Math.sin(T * 2 + k.length) * .15); r.material.color.set(here ? 0x8ff0c8 : 0xffc96b); r.scale.setScalar(1 + Math.sin(T * 2) * .04); }
  stoneNote.rotation.y += dt * .4;
  // HTML overlays
  const bub = $('#bubble'); if (toScreen(G.root.position, bub, 3.4, 34)){ const t = gravesLine(); if (bub._t !== t){ $('#btext').textContent = t; bub._t = t; } const hw = bub.offsetWidth / 2 + 8; bub.style.left = clamp(parseFloat(bub.style.left), hw, innerWidth - hw) + 'px'; bub.style.top = Math.max(parseFloat(bub.style.top), bub.offsetHeight + (innerWidth < 600 ? 120 : 112)) + 'px'; }
  toScreen(wisp.position, $('#tag-you'), .7, 30);
  for (const k of KEYS){ toScreen(PLACES[k].pos, labelEls[k], k === 'offering_stone' ? 3 : k === 'bone_garden' ? 2.2 : 9, 60); }
  composer.render(dt);
  // Adapt render resolution while preserving the selected graphics level.
  frames++; if (dt > .028) slowFrames++;
  if (frames === 240){
    if (slowFrames > 144 && renderScale > .65) setRenderScale(renderScale - .12);
    else if (slowFrames < 48 && renderScale < 1) setRenderScale(Math.min(1, renderScale + .06));
    frames = 0; slowFrames = 0;
  }
  if (!document.hidden) rafId = requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
(async () => {
  try {
    await refresh();
    // start Graves near the crypt door; he'll walk to wherever his mind says he is
    if (SHOT){ G.root.position.copy(PLACES[graves.home].stand); wisp.position.copy(PLACES[graves.home].stand).add(new THREE.Vector3(-.6, 1.1, 3.6)); cam.look.copy(wisp.position); cam.yaw = -.5; cam.dist = MOBILE ? 11 : 9; if (/over/.test(location.search)){ wisp.position.set(0, 1.1, 14); cam.look.copy(wisp.position); cam.dist = 34; cam.pitch = .62; cam.yaw = 0; } }
    else { const saved = loadWorldPosition(); if (saved) wisp.position.set(saved.x, groundY(saved.x, saved.z) + 1.1, saved.z); else wisp.position.copy(PLACES[graves.home].ring).add(new THREE.Vector3(0, 1.1, 5)); cam.look.copy(wisp.position); }
    activeWaypoint = resolveLandmarkId(localStorage.getItem(WORLD_WAYPOINT_KEY));
    setInterval(refresh, 300000);
    window.__g3dReady = true; clearTimeout(window.__g3dFallback);
    applyQuality();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden){ cancelAnimationFrame(rafId); rafId = 0; }
      else { last = performance.now(); if (!rafId) rafId = requestAnimationFrame(frame); }
    });
    rafId = requestAnimationFrame(frame);
    setTimeout(() => { $('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 900); }, 300);
    if (!localStorage.getItem('g3d_seen') && !SHOT){ show('help'); localStorage.setItem('g3d_seen', 1); }
  } catch (e){ console.error(e); location.replace('town.html?err3d=1'); }
})();
