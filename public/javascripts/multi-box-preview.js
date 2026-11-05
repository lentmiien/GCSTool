(function () {
  'use strict';
  // All box cards share one WebGL context. Each keeps a 2D canvas snapshot so
  // large plans do not hit the browser's limit on simultaneous WebGL contexts.
  window.createMultiBoxPreviews = function () {
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const previews = [];

    function add(host, box, colorFor) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable.');
      host.replaceChildren(canvas);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      const controls = new THREE.OrbitControls(camera, canvas);
      controls.minDistance = 0.3;
      controls.maxDistance = 12;
      const scale = 1 / Math.max(...box.dimensions);
      const [width, height, depth] = box.dimensions.map((value) => value * scale);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const light = new THREE.DirectionalLight(0xffffff, 0.65);
      light.position.set(2, 4, 3);
      scene.add(light);
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial());
      geometry.dispose();
      frame.position.set(0, height / 2, 0);
      scene.add(frame);
      const outlines = [];
      box.items.forEach((item) => {
        const placement = window.MultiBoxData.placement(item);
        if (!placement) return;
        const dimensions = placement.dimensions.map((value) => value * scale);
        const geometry = new THREE.BoxGeometry(...dimensions);
        const material = new THREE.MeshLambertMaterial({ color: colorFor(item), transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geometry, material);
        // API X=width, Y=height, Z=depth; center and row-major local-to-world
        // rotation are used directly, including non-orthogonal rotations.
        const m = placement.matrix;
        const rotation = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
        mesh.setRotationFromMatrix(rotation);
        const [x, y, z] = placement.center;
        mesh.position.set(x * scale - width / 2, y * scale, z * scale - depth / 2);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.65 }));
        edges.position.copy(mesh.position);
        edges.quaternion.copy(mesh.quaternion);
        outlines.push(edges);
        scene.add(mesh, edges);
      });
      function render() {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        renderer.render(scene, camera);
        canvas.width = renderer.domElement.width;
        canvas.height = renderer.domElement.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(renderer.domElement, 0, 0);
      }
      function reset() {
        controls.target.set(0, height / 2, 0);
        const aspect = host.clientWidth / host.clientHeight || 1;
        const angle = camera.fov * Math.PI / 360;
        const distance = Math.hypot(width, height, depth) / 2 / Math.sin(Math.min(angle, Math.atan(Math.tan(angle) * aspect))) * 1.15;
        camera.position.copy(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(distance).add(controls.target));
        controls.update();
        render();
      }
      function theme() {
        const dark = document.documentElement.dataset.colorMode !== 'light';
        frame.material.color.set(dark ? 0x91a7b5 : 0x526970);
        outlines.forEach((edge) => edge.material.color.set(dark ? 0xe2edf3 : 0x152c34));
        render();
      }
      controls.addEventListener('change', render);
      const observer = new ResizeObserver(render);
      observer.observe(host);
      previews.push({ theme, dispose() {
        observer.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) object.material.dispose();
        });
        host.replaceChildren();
      } });
      theme();
      reset();
      return { reset };
    }
    const observer = new MutationObserver(() => previews.forEach((preview) => preview.theme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode'] });
    return { add, dispose() {
      observer.disconnect();
      previews.forEach((preview) => preview.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    } };
  };
}());
