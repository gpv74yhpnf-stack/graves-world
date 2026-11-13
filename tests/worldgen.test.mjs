import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_SIZE,
  UNDERWORLD_BIOMES,
  biomeForChunk,
  chunkHash,
  chunksAround,
  createChunkRandom,
  worldGroundHeight
} from '../src/worldgen/undercroft.mjs';

test('generated chunks have stable seeds and region-scale biomes', () => {
  assert.equal(chunkHash(8, -4), chunkHash(8, -4));
  assert.notEqual(chunkHash(8, -4), chunkHash(9, -4));
  assert.equal(biomeForChunk(0, 0).id, biomeForChunk(2, 2).id);
  assert.ok(UNDERWORLD_BIOMES.some(biome => biome.id === biomeForChunk(-250, 870).id));
});

test('each chunk repeats its decoration sequence and uses a separate sequence', () => {
  const first = createChunkRandom(-11, 19), repeated = createChunkRandom(-11, 19), next = createChunkRandom(-10, 19);
  const values = Array.from({length:8}, () => first());
  assert.deepEqual(values, Array.from({length:8}, () => repeated()));
  assert.notDeepEqual(values, Array.from({length:8}, () => next()));
  assert.ok(values.every(value => value >= 0 && value < 1));
});

test('streaming loads nearby chunks symmetrically at positive and negative coordinates', () => {
  assert.equal(chunksAround(0, 0).length, 9);
  assert.equal(chunksAround(CHUNK_SIZE, -CHUNK_SIZE).length, 9);
  assert.deepEqual(chunksAround(-1, -1).map(chunk => [chunk.x, chunk.z]), [
    [-2,-2],[-1,-2],[0,-2],[-2,-1],[-1,-1],[0,-1],[-2,0],[-1,0],[0,0]
  ]);
});

test('terrain stays level in the town and continuous through the generated frontier', () => {
  assert.equal(worldGroundHeight(0, 0), 0);
  assert.equal(worldGroundHeight(20, 20), 0);
  for (const z of [-100, -20, 0, 40, 110]){
    const before = worldGroundHeight(CHUNK_SIZE - 0.001, z);
    const after = worldGroundHeight(CHUNK_SIZE + 0.001, z);
    assert.ok(Math.abs(after - before) < 0.01);
  }
});
