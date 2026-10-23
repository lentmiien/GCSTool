const container = { id: 'Box S', w: 200, d: 150, h: 100, emptyWeight: 0.1, maxLoadWeight: 5, tags: ['fold-box'] };
const catalog = { containers: [container], revision: 4, tags: ['fold-box', 'tube'] };
const result = {
  success: true,
  container,
  data: { success: true, pallets: [{ containerId: 'Box S', w: 200, d: 150, h: 100, placements: [
    { itemId: 'widget', x: 0, y: 0, z: 0, w: 100, d: 80, h: 50 },
    { itemId: 'widget', x: 0, y: 0, z: 50, w: 100, d: 80, h: 50 },
    { itemId: 'tall', x: 100, y: 0, z: 0, w: 80, d: 50, h: 100 },
  ] }] },
  meta: { algorithm: 'laff', totalItemCount: 3, uniqueItems: 2, totalContainers: 2, tagFilteredContainers: 1, eligibleContainers: 1, filteredContainers: 1, attempts: 1 },
};
const input = 'widget .2kg 100×80×50 \n2\ntall .3kg 100×80×50 \n1';

// Margin offsets are already part of API coordinates, including for alternatives.
function solutionV2(box, placements) {
  const emptyVolume = box.w * box.d * box.h - 1200000;
  const estimatedCushionWeight = Number((emptyVolume * 8.22e-9).toFixed(6));
  return {
    success: true,
    container: box,
    estimatedCushionWeight,
    estimatedShipmentWeight: Number((0.7 + box.emptyWeight + estimatedCushionWeight).toFixed(6)),
    data: { success: true, pallets: [{ containerId: box.id, w: box.w, d: box.d, h: box.h, placements }] },
    meta: { ...result.meta, attempts: 3, eligibleContainers: 3, totalContainers: 4, safetyMarginMm: 10,
      usableDimensions: { w: box.w - 20, d: box.d - 20, h: box.h - 20 }, emptyVolume,
      cushionDensityKgPerM3: 8.22, alternativesSearchComplete: true },
  };
}
const marginPlacements = result.data.pallets[0].placements.map((p) => ({ ...p, x: p.x + 10, y: p.y + 10, z: p.z + 10 }));
const resultV2 = {
  ...solutionV2({ ...container, w: 220, d: 170, h: 120 }, marginPlacements),
  alternatives: [
    solutionV2({ ...container, id: 'Box M', w: 260, d: 200, h: 160, emptyWeight: 0.2 }, marginPlacements),
    solutionV2({ ...container, id: 'Box L', w: 300, d: 240, h: 180, emptyWeight: 0.3 }, marginPlacements.map((p, index) => ({ ...p, x: 10 + index * 100, z: 10 }))),
  ],
};
module.exports = { container, catalog, result, resultV2, input };
