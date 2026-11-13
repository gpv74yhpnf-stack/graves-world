export const CHUNK_SIZE = 48;
export const CHUNK_LOAD_RADIUS = 2;
export const CHUNK_UNLOAD_RADIUS = 2;
export const WORLD_SEED = 0x47524156;
const BIOME_REGION_SIZE = 4;
const LANDMARK_CELL_SIZE = 5;
const LANDMARK_MIN_RADIUS = 78;

export const UNDERWORLD_BIOMES = Object.freeze([
  Object.freeze({id:'soulglass', name:'Soulglass Caverns', form:'crystal', tint:'#303f59', accent:'#8ff0c8'}),
  Object.freeze({id:'ash-quarry', name:'Ashen Quarry', form:'stone', tint:'#454253', accent:'#b7a4d4'}),
  Object.freeze({id:'bone-orchard', name:'Bone Orchard', form:'bone', tint:'#4b4258', accent:'#e8e1f2'}),
  Object.freeze({id:'echo-fens', name:'Echo Fens', form:'fungus', tint:'#293c40', accent:'#ff8fb1'}),
  Object.freeze({id:'sunken-archives', name:'Sunken Archives', form:'ruins', tint:'#34405a', accent:'#8eb7ff'}),
  Object.freeze({id:'blackglass-reach', name:'Blackglass Reach', form:'basalt', tint:'#272b3b', accent:'#68d7e2'}),
  Object.freeze({id:'mothlight-cathedral', name:'Mothlight Cathedral', form:'moth', tint:'#40384a', accent:'#eadb84'}),
  Object.freeze({id:'the-last-ward', name:'The Last Ward', form:'ward', tint:'#3b394a', accent:'#b9c5ff'})
]);

const LANDMARK_FORMS = Object.freeze({
  crystal:'resonance-spire',
  stone:'shattered-gate',
  bone:'bone-crown',
  fungus:'drowned-bell',
  ruins:'archive-relay',
  basalt:'blackwater-well',
  moth:'mothlight-grove',
  ward:'last-watch'
});
const LANDMARK_NOUNS = Object.freeze({
  'resonance-spire':['Resonance Spire','Singing Needle','Soulglass Beacon'],
  'shattered-gate':['Shattered Gate','Ashen Threshold','Quarry Crown'],
  'bone-crown':['Bone Crown','Ossuary Arch','Pale Sentinel'],
  'drowned-bell':['Drowned Bell','Mire Lantern','Fen Choir'],
  'archive-relay':['Archive Relay','Scribe’s Stair','Memory Engine'],
  'blackwater-well':['Blackwater Well','Obsidian Eye','Deepwell Shrine'],
  'mothlight-grove':['Mothlight Grove','Lumen Crown','Lantern Bloom'],
  'last-watch':['Last Watch','Quiet Ward','Warden’s Rest']
});
const LANDMARK_EPITHETS = Object.freeze(['Hollow','Wandering','Forgotten','Mourning','Veiled','Silent','Twilit','Buried']);

export function chunkHash(chunkX, chunkZ, seed = WORLD_SEED){
  let h = Math.imul((chunkX | 0) ^ seed, 0x45d9f3b);
  h ^= Math.imul((chunkZ | 0) ^ Math.imul(seed, 0x27d4eb2d), 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function biomeForChunk(chunkX, chunkZ, seed = WORLD_SEED){
  const regionX = Math.floor(chunkX / BIOME_REGION_SIZE);
  const regionZ = Math.floor(chunkZ / BIOME_REGION_SIZE);
  return UNDERWORLD_BIOMES[chunkHash(regionX, regionZ, seed) % UNDERWORLD_BIOMES.length];
}

export function createChunkRandom(chunkX, chunkZ, seed = WORLD_SEED){
  let state = chunkHash(chunkX, chunkZ, seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One deterministic, biome-themed landmark is placed in each distant 5×5 chunk cell. */
export function landmarkForChunk(chunkX, chunkZ, seed = WORLD_SEED){
  const cellX = Math.floor(chunkX / LANDMARK_CELL_SIZE);
  const cellZ = Math.floor(chunkZ / LANDMARK_CELL_SIZE);
  const placement = chunkHash(cellX, cellZ, seed ^ 0x5f356495);
  const landmarkChunkX = cellX * LANDMARK_CELL_SIZE + placement % LANDMARK_CELL_SIZE;
  const landmarkChunkZ = cellZ * LANDMARK_CELL_SIZE + Math.floor(placement / LANDMARK_CELL_SIZE) % LANDMARK_CELL_SIZE;
  if (chunkX !== landmarkChunkX || chunkZ !== landmarkChunkZ) return null;
  const worldX = (chunkX + 0.5) * CHUNK_SIZE, worldZ = (chunkZ + 0.5) * CHUNK_SIZE;
  if (Math.hypot(worldX, worldZ) < LANDMARK_MIN_RADIUS) return null;
  const biome = biomeForChunk(chunkX, chunkZ, seed);
  const type = LANDMARK_FORMS[biome.form];
  const signature = chunkHash(cellX, cellZ, seed ^ 0x68bc21eb);
  const nouns = LANDMARK_NOUNS[type];
  return Object.freeze({
    id: cellX + ':' + cellZ,
    name: 'The ' + LANDMARK_EPITHETS[(signature >>> 3) % LANDMARK_EPITHETS.length] + ' ' + nouns[(signature >>> 11) % nouns.length],
    type,
    biomeId: biome.id,
    variant: (signature >>> 19) % 8
  });
}

export function worldGroundHeight(x, z){
  const radius = Math.hypot(x, z);
  if (radius < 34) return 0;
  const foothill = Math.pow((radius - 34) / 10, 2) * 3 * (0.7 + 0.3 * Math.sin(x * 0.3) * Math.cos(z * 0.25));
  if (radius < 44) return foothill;
  const warp = 0.35 * Math.sin((x + z) * 0.035) * Math.cos((z - x) * 0.041);
  const ridges = 1.8 + 1.15 * Math.sin(x * 0.055 + warp) * Math.cos(z * 0.061 - warp)
    + 0.65 * Math.sin((x - z) * 0.12) + 0.45 * Math.cos(radius * 0.17)
    + 0.55 * Math.sin((x + z * 0.35) * 0.021);
  const blend = Math.min(1, (radius - 44) / 20);
  return foothill * (1 - blend) + ridges * blend;
}

export function chunksAround(x, z, loadRadius = CHUNK_LOAD_RADIUS){
  const centerX = Math.floor(x / CHUNK_SIZE), centerZ = Math.floor(z / CHUNK_SIZE), chunks = [];
  for (let dz = -loadRadius; dz <= loadRadius; dz++){
    for (let dx = -loadRadius; dx <= loadRadius; dx++) chunks.push({x:centerX + dx, z:centerZ + dz});
  }
  return chunks;
}
