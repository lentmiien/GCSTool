/** @jest-environment jsdom */
const fs = require('fs');
const THREE = require('../public/javascripts/three');
const { rigid } = require('./fixtures/multiBox');
const script = fs.readFileSync('public/javascripts/multi-box-preview.js', 'utf8');
let renderer;
let drawImage;
let resizeObservers;
let controls;

beforeEach(() => {
  document.documentElement.dataset.colorMode = 'dark';
  document.body.replaceChildren();
  drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: jest.fn(), drawImage });
  renderer = {
    domElement: document.createElement('canvas'), setPixelRatio: jest.fn(), setSize: jest.fn(), render: jest.fn(), dispose: jest.fn(), forceContextLoss: jest.fn(),
  };
  controls = [];
  resizeObservers = [];
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.disconnect = jest.fn(); resizeObservers.push(this); }
    observe() {}
  };
  window.THREE = {
    ...THREE,
    WebGLRenderer: jest.fn(() => renderer),
    OrbitControls: class {
      constructor() { this.target = new THREE.Vector3(); this.update = jest.fn(); this.dispose = jest.fn(); controls.push(this); }
      addEventListener() {}
    },
  };
  window.MultiBoxData = require('../public/javascripts/multi-box-data');
  window.eval(script);
});
afterEach(() => jest.restoreAllMocks());
function host() {
  const node = document.createElement('div');
  Object.defineProperties(node, { clientWidth: { value: 600 }, clientHeight: { value: 380 } });
  document.body.appendChild(node);
  return node;
}

test('rotates local dimensions into API world coordinates, excludes soft items and shares one context across many boxes', () => {
  const matrix = [0, 1, 0, 0, 0, 1, 1, 0, 0];
  const item = { ...rigid, dimensions: [10, 1, 1], center: [1.5, 2.9, 6], orientation: { matrix } };
  const box = { dimensions: [25.6, 4.5, 18.1], items: [item, { id: 'soft', soft: true }] };
  const group = window.createMultiBoxPreviews();
  for (let index = 0; index < 20; index++) group.add(host(), box, () => '#ff0000');
  expect(window.THREE.WebGLRenderer).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('canvas')).toHaveLength(20);
  const scene = renderer.render.mock.calls[0][0];
  const meshes = scene.children.filter((object) => object.isMesh);
  expect(meshes).toHaveLength(1);
  const mesh = meshes[0];
  expect(mesh.geometry.parameters.width).toBeCloseTo(10 / 25.6);
  expect(mesh.position.x).toBeCloseTo(1.5 / 25.6 - 0.5);
  expect(mesh.position.y).toBeCloseTo(2.9 / 25.6);
  expect(mesh.position.z).toBeCloseTo((6 - 18.1 / 2) / 25.6);
  const rotatedWidth = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
  expect(rotatedWidth.x).toBeCloseTo(0);
  expect(rotatedWidth.y).toBeCloseTo(0);
  expect(rotatedWidth.z).toBeCloseTo(1);
  expect(drawImage).toHaveBeenCalled();
  group.dispose();
  expect(renderer.dispose).toHaveBeenCalled();
  expect(renderer.forceContextLoss).toHaveBeenCalled();
  expect(controls.every((control) => control.dispose.mock.calls.length === 1)).toBe(true);
  expect(resizeObservers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
  expect(document.querySelectorAll('canvas')).toHaveLength(0);
});

test('updates frame and item outlines when switching from dark to light mode', async () => {
  const group = window.createMultiBoxPreviews();
  group.add(host(), { dimensions: [30, 20, 25], items: [rigid] }, () => '#ff0000');
  const scene = renderer.render.mock.calls[0][0];
  const lines = scene.children.filter((object) => object.isLineSegments);
  expect(lines[0].material.color.getHex()).toBe(0x91a7b5);
  expect(lines[1].material.color.getHex()).toBe(0xe2edf3);
  document.documentElement.dataset.colorMode = 'light';
  await Promise.resolve();
  expect(lines[0].material.color.getHex()).toBe(0x526970);
  expect(lines[1].material.color.getHex()).toBe(0x152c34);
  group.dispose();
});
