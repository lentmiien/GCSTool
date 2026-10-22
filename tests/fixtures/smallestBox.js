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
module.exports = { container, catalog, result, input };
