import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_LOAD_RADIUS,
  CHUNK_SIZE,
  CHUNK_UNLOAD_RADIUS,
  UNDERWORLD_BIOMES,
  biomeForChunk,
  chunkHash,
  chunksAround,
  createChunkRandom,
  landmarkForCell,
  landmarkForChunk,
  worldGroundHeight
} from '../src/worldgen/undercroft.mjs';

test('generated chunks have stable seeds and region-scale biomes', () => {
  assert.equal(chunkHash(8, -4), chunkHash(8, -4));
  assert.notEqual(chunkHash(8, -4), chunkHash(9, -4));
  assert.equal(biomeForChunk(0, 0).id, biomeForChunk(2, 2).id);
  assert.ok(UNDERWORLD_BIOMES.length >= 8);
  assert.ok(UNDERWORLD_BIOMES.some(biome => biome.id === biomeForChunk(-250, 870).id));
});

test('each chunk repeats its decoration sequence and uses a separate sequence', () => {
  const first = createChunkRandom(-11, 19), repeated = createChunkRandom(-11, 19), next = createChunkRandom(-10, 19);
  const values = Array.from({length:8}, () => first());
  assert.deepEqual(values, Array.from({length:8}, () => repeated()));
  assert.notDeepEqual(values, Array.from({length:8}, () => next()));
  assert.ok(values.every(value => value >= 0 && value < 1));
});

test('streaming loads a wider neighborhood symmetrically at positive and negative coordinates', () => {
  assert.equal(CHUNK_LOAD_RADIUS, 2);
  assert.equal(CHUNK_UNLOAD_RADIUS, 2);
  assert.equal(chunksAround(0, 0).length, 25);
  assert.equal(chunksAround(CHUNK_SIZE, -CHUNK_SIZE).length, 25);
  assert.deepEqual(chunksAround(-1, -1, 1).map(chunk => [chunk.x, chunk.z]), [
    [-2,-2],[-1,-2],[0,-2],[-2,-1],[-1,-1],[0,-1],[-2,0],[-1,0],[0,0]
  ]);
});

test('landmarks are stable, biome themed, and spread through the expanding world', () => {
  let found = null;
  for (let z = -80; z <= 80 && !found; z++){
    for (let x = -80; x <= 80; x++){
      const landmark = landmarkForChunk(x, z);
      if (landmark){ found = {x,z,landmark}; break; }
    }
  }
  assert.ok(found, 'distant chunks should contain landmarks');
  assert.deepEqual(landmarkForChunk(found.x, found.z), found.landmark);
  assert.equal(found.landmark.biomeId, biomeForChunk(found.x, found.z).id);
  assert.match(found.landmark.name, /^The .+/);
  assert.equal(found.landmark.x, (found.x + 0.5) * CHUNK_SIZE);
  assert.equal(found.landmark.z, (found.z + 0.5) * CHUNK_SIZE);
  const [cellX, cellZ] = found.landmark.id.split(':').map(Number);
  assert.deepEqual(landmarkForCell(cellX, cellZ), found.landmark);
});

test('terrain stays level in town and continuous through the generated frontier', () => {
  assert.equal(worldGroundHeight(0, 0), 0);
  assert.equal(worldGroundHeight(20, 20), 0);
  for (const z of [-100, -20, 0, 40, 110]){
    const before = worldGroundHeight(CHUNK_SIZE - 0.001, z);
    const after = worldGroundHeight(CHUNK_SIZE + 0.001, z);
    assert.ok(Math.abs(after - before) < 0.01);
  }
  for (const [x,z] of [[120,60],[-350,-820],[1000,-240]]){
    assert.ok(Number.isFinite(worldGroundHeight(x,z)));
  }
});
