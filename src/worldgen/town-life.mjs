const route = points => Object.freeze(points.map(([x, z]) => Object.freeze({ x, z })));

// Fictional residents and simple walking loops for the authored town square.
// This data is static world decoration and never reads visitor or mind state.
export const TOWN_RESIDENTS = Object.freeze([
  Object.freeze({
    id: 'wick', name: 'Wick', role: 'Lantern keeper', robe: 0x514263, accent: 0xffc96b, prop: 'lantern',
    route: route([[-19, 8], [-16, 9], [-12, 8], [-9, 7], [-13, 5]])
  }),
  Object.freeze({
    id: 'quill', name: 'Quill', role: 'Moon archivist', robe: 0x35466f, accent: 0x8eb7ff, prop: 'book',
    route: route([[-12, -16], [-9, -14], [8, -14], [11, -16], [9, -19], [-9, -19]])
  }),
  Object.freeze({
    id: 'bramble', name: 'Bramble', role: 'Bone gardener', robe: 0x355447, accent: 0x8ff0c8, prop: 'flower',
    route: route([[7, 5], [10, 8], [15, 8], [19, 5], [17, 2], [11, 3]])
  }),
  Object.freeze({
    id: 'morrow', name: 'Morrow', role: 'Letter courier', robe: 0x61415d, accent: 0xff8fb1, prop: 'satchel',
    route: route([[4, 14], [8, 15], [13, 13], [17, 11], [17, 8], [12, 8]])
  }),
  Object.freeze({
    id: 'tallow', name: 'Tallow', role: 'Market apprentice', robe: 0x505237, accent: 0xffd06b, prop: 'scroll',
    route: route([[28, 7], [32, 5], [33, 1], [32, -3], [28, -4], [24, -3], [22, 1], [24, 5]])
  })
]);
