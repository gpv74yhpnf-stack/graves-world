export const CHUNK_SIZE = 48;
export const CHUNK_LOAD_RADIUS = 1;
export const CHUNK_UNLOAD_RADIUS = 2;
export const WORLD_SEED = 0x47524156;
const BIOME_REGION_SIZE = 3;

export const UNDERWORLD_BIOMES = Object.freeze([
  Object.freeze({id:'soulglass', name:'Soulglass Caverns', form:'crystal', tint:'#303f59', accent:'#8ff0c8'}),
  Object.freeze({id:'ash-quarry', name:'Ashen Quarry', form:'stone', tint:'#454253', accent:'#b7a4d4'}),
  Object.freeze({id:'bone-orchard', name:'Bone Orchard', form:'bone', tint:'#4b4258', accent:'#e8e1f2'}),
  Object.freeze({id:'echo-fens', name:'Echo Fens', form:'fungus', tint:'#293c40', accent:'#ff8fb1'}),
  Object.freeze({id:'sunken-archives', name:'Sunken Archives', form:'ruins', tint:'#34405a', accent:'#8eb7ff'})
]);

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

export function worldGroundHeight(x, z){
  const radius = Math.hypot(x, z);
  if (radius < 34) return 0;
  const foothill = Math.pow((radius - 34) / 10, 2) * 3 * (0.7 + 0.3 * Math.sin(x * 0.3) * Math.cos(z * 0.25));
  if (radius < 44) return foothill;
  const wild = 1.8 + 1.15 * Math.sin(x * 0.055) * Math.cos(z * 0.061) + 0.65 * Math.sin((x - z) * 0.12) + 0.45 * Math.cos(radius * 0.17);
  const blend = Math.min(1, (radius - 44) / 20);
  return foothill * (1 - blend) + wild * blend;
}

export function chunksAround(x, z, loadRadius = CHUNK_LOAD_RADIUS){
  const centerX = Math.floor(x / CHUNK_SIZE), centerZ = Math.floor(z / CHUNK_SIZE), chunks = [];
  for (let dz = -loadRadius; dz <= loadRadius; dz++){
    for (let dx = -loadRadius; dx <= loadRadius; dx++) chunks.push({x:centerX + dx, z:centerZ + dz});
  }
  return chunks;
}
