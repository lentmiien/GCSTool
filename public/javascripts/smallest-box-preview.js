(function () {
  'use strict';

  window.createSmallestBoxPreview = function (host, box, placements, colors) {
    const THREE = window.THREE;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.replaceChildren(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0.3;
    controls.maxDistance = 12;
    const scale = 1 / Math.max(box.w, box.d, box.h);
    const width = box.w * scale;
    const depth = box.d * scale;
    const height = box.h * scale;
    const render = () => renderer.render(scene, camera);
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(2, 4, 3);
    scene.add(light);

    const boxGeometry = new THREE.BoxGeometry(width, height, depth);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), new THREE.LineBasicMaterial());
    boxGeometry.dispose();
    frame.position.set(0, height / 2, 0);
    scene.add(frame);
    const grid = new THREE.GridHelper(1.3, 10);
    grid.position.y = -0.002;
    scene.add(grid);

    const objects = placements.map((placement) => {
      // API: x = width, y = depth, z = height. Three.js uses Y up.
      const geometry = new THREE.BoxGeometry(placement.w * scale, placement.h * scale, placement.d * scale);
      const material = new THREE.MeshLambertMaterial({ color: colors.get(placement.itemId), transparent: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((placement.x + placement.w / 2) * scale - width / 2,
        (placement.z + placement.h / 2) * scale, (placement.y + placement.d / 2) * scale - depth / 2);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ transparent: true }));
      edges.position.copy(mesh.position);
      scene.add(mesh, edges);
      return { mesh, edges, z: placement.z };
    });
    let selectedZ = 0;
    let showAbove = false;
    let dark = true;
    function updateLayer(z, above) {
      selectedZ = z;
      showAbove = above;
      objects.forEach(({ mesh, edges, z: bottom }) => {
        const active = bottom === z;
        mesh.visible = bottom <= z;
        mesh.material.opacity = active ? 0.92 : 0.16;
        mesh.material.depthWrite = active;
        mesh.material.emissive.copy(mesh.material.color);
        mesh.material.emissiveIntensity = active ? 0.12 : 0;
        edges.visible = bottom <= z || above;
        edges.material.color.set(active ? (dark ? 0xffffff : 0x152c34) : (dark ? 0x91a7b5 : 0x526970));
        edges.material.opacity = active ? 0.95 : 0.3;
      });
      render();
    }
    function theme() {
      dark = document.documentElement.dataset.colorMode !== 'light';
      frame.material.color.set(dark ? 0x91a7b5 : 0x526970);
      grid.material.color.set(dark ? 0x607985 : 0x789097);
      grid.material.transparent = true;
      grid.material.opacity = 0.3;
      updateLayer(selectedZ, showAbove);
    }
    function resize() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      render();
    }
    function reset() {
      controls.target.set(0, height / 2, 0);
      const aspect = host.clientWidth / host.clientHeight || 1;
      const verticalHalfAngle = camera.fov * Math.PI / 360;
      const halfAngle = Math.min(verticalHalfAngle, Math.atan(Math.tan(verticalHalfAngle) * aspect));
      const radius = Math.hypot(width, height, depth) / 2;
      const distance = radius / Math.sin(halfAngle) * 1.15;
      camera.position.copy(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(distance).add(controls.target));
      controls.update();
      render();
    }
    controls.addEventListener('change', render);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const themeObserver = new MutationObserver(theme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode'] });
    reset();
    theme();
    resize();

    return {
      updateLayer,
      reset,
      dispose() {
        resizeObserver.disconnect();
        themeObserver.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
        renderer.dispose();
        renderer.forceContextLoss();
        host.replaceChildren();
      },
    };
  };
}());
