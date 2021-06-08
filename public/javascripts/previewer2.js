const outputs = document.getElementsByClassName('renderoutput');
for(let oi = 0; oi < outputs.length; oi++) {
  const data = JSON.parse(document.getElementsByClassName(outputs[oi].id)[0].innerHTML);
  const boxdata = JSON.parse(document.getElementsByClassName(`${outputs[oi].id}_boxsize`)[0].innerHTML);
  console.log(document.getElementsByClassName(`${outputs[oi].id}_boxsize`)[0].innerHTML);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  const renderer = new THREE.WebGLRenderer();
  const controls = new THREE.OrbitControls( camera, renderer.domElement );

  renderer.setSize( window.innerWidth, window.innerHeight );
  outputs[oi].appendChild( renderer.domElement );

  data.forEach(entry => {
    const itemSize = [entry.dim[0]/100, entry.dim[1]/100, entry.dim[2]/100];
    const itemPosition = [entry.pos[0]/100, entry.pos[1]/100, entry.pos[2]/100];
    const geometry = new THREE.BoxGeometry(itemSize[0], itemSize[1], itemSize[2]);
    const material = new THREE.MeshStandardMaterial( { color: new THREE.Color( Math.random(), Math.random(), Math.random() ) } );
    const cube = new THREE.Mesh( geometry, material );
    cube.position.x = itemPosition[0] + itemSize[0]/2 - boxdata.w/200;
    cube.position.y = itemPosition[1] + itemSize[1]/2 - boxdata.h/200;
    cube.position.z = itemPosition[2] + itemSize[2]/2 - boxdata.d/200;
    scene.add( cube );
  });

  // Safety box siza
  const geometry = new THREE.BoxGeometry(boxdata.w/100, boxdata.h/100, boxdata.d/100);
  const material = new THREE.MeshBasicMaterial( { color: 0xffffff } );
  material.wireframe = true;
  const cube = new THREE.Mesh( geometry, material );
  scene.add( cube );
  // Real box size
  const safety = parseFloat(document.getElementById('safety').innerHTML);
  const real_geometry = new THREE.BoxGeometry(boxdata.w/100/safety, boxdata.h/100/safety, boxdata.d/100/safety);
  const real_cube = new THREE.Mesh( real_geometry, material );
  scene.add( real_cube );

  const ambientLight = new THREE.AmbientLight( 0xcccccc, 0.4 );
  scene.add( ambientLight );

  const pointLight = new THREE.PointLight( 0xffffff, 0.8 );
  camera.add( pointLight );
  scene.add( camera );

  camera.position.z = 10;
  controls.update();

  const animate = function () {
    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );
  };

  animate();
}