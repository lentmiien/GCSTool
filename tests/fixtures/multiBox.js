const input = 'GOODS-04825603 .07kg 235×154×9\n2';
const jobId = '72d718c0-3574-4d0c-a1bc-34c64b87ae27';
const catalog = {
  revision: 3, excludedContainers: 1, units: { dimensions: 'cm', weight: 'kg' },
  containers: [
    { id: 'Box S', width: 30, height: 20, depth: 25, max_weight: 4.5, emptyWeight: 0.2, tags: ['fold-box'] },
    { id: 'Box M', width: 45, height: 30, depth: 35, max_weight: 9, emptyWeight: 0.4, tags: [] },
  ],
};
const rigid = {
  id: 'GOODS-04825603', width: 23.5, height: 0.9, depth: 15.4, weight: 0.07, value: 0, shrink: 0, soft: false, fragile: false,
  center: [12.75, 1.45, 8.7], dimensions: [23.5, 0.9, 15.4], position: [1, 1, 1],
  orientation: { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
};
const weights = { itemWeight: 0.07, emptyBoxWeight: 0.2, emptyVolumeCm3: 14674.29, estimatedCushionWeight: 0.12, estimatedShipmentWeight: 0.39, maxLoadWeight: 4.5, exceedsMaxLoadWeight: false };
const result = {
  version: 1, units: { dimensions: 'cm', weight: 'kg' }, coordinates: 'X=width,Y=height,Z=depth', options: { approach: 'boxes', margin: 1 },
  boxes: [
    { id: 'box-1', type: 'Box S', dimensions: [30, 20, 25], items: [rigid], weightEstimate: weights },
    { id: 'box-2', type: 'Box S', dimensions: [30, 20, 25], items: [{ ...rigid, id: 'GOODS-04825603-copy-2' }], weightEstimate: weights },
  ],
  unplaced: [], stats: { inputItems: 2, packedItems: 2, boxCount: 2, fill: 0.02, elapsedMs: 125 },
};
const queued = { jobId, status: 'queued', statusUrl: `/api/binpacking-multi/jobs/${jobId}`, queuePosition: 1, progress: null };
const completed = { ...queued, status: 'completed', queuePosition: null, result };
module.exports = { input, jobId, catalog, rigid, result, queued, completed };
