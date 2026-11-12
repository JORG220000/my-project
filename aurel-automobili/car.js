/* AUREL V01 — original procedural model. Three.js r160, locally bundled. */
(() => {
  'use strict';
  const host = document.getElementById('car-scene');
  const loader = document.getElementById('scene-loading');
  const fallback = document.getElementById('scene-fallback');
  const fail = () => { loader.hidden = true; fallback.hidden = false; host.style.cursor = 'default'; document.documentElement.classList.remove('has-webgl'); };
  if (!window.THREE) { fail(); return; }
  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (_) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const slots = [{id:'main',element:host,visible:true},{id:'aero',element:document.getElementById('aero-model'),visible:false},{id:'config',element:document.getElementById('config-model'),visible:false}];
  let activeHost=host, activeView='main';
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(31, 1, .1, 80);
  const detailCamera = new T.OrthographicCamera(-3.35,3.35,1.5,-1.5,.1,80);
  const model = new T.Group();
  scene.add(model);
  const parts = {}, clickable = [], paintMaterials = [];
  const state = { exploded: false, selected: 'body', progress: 0, view: 'front', paused: false, rotation: 0, targetRotation: 0, visible: true, interactive: false, drive:'strada' };
  let needsRender = true;
  const color = { silver: 0xbfc7c7, orange: 0xe94f1b, black: 0x1d252b };
  const mk = (hex, roughness = .4, metalness = .7, extra = {}) => new T.MeshStandardMaterial({ color: hex, roughness, metalness, ...extra });
  const paint = new T.MeshPhysicalMaterial({ color: color.silver, metalness: .82, roughness: .25, clearcoat: 1, clearcoatRoughness: .18 });
  paintMaterials.push(paint);
  const carbon = mk(0x101416, .74, .18);
  const dark = mk(0x080d10, .4, .5);
  const rubber = mk(0x111418, .86, .05);
  const silver = mk(0x9fa8ae, .25, .95);
  const graphite = mk(0x3f484e, .35, .92);
  const orange = mk(0xef5124, .36, .5);
  const glass = new T.MeshPhysicalMaterial({ color: 0x14242e, metalness: .3, roughness: .12, clearcoat: 1, clearcoatRoughness: .08 });
  const light = mk(0xbde6ff, .2, .3, { emissive: 0x9edcff, emissiveIntensity: 2.4 });
  const rearLight = mk(0xff3d1c, .3, .2, { emissive: 0xff250a, emissiveIntensity: 2.1 });

  // A lightweight studio environment supplies reflections without remote textures.
  const studio = new T.Scene();
  studio.background = new T.Color(0x343b43);
  const addPanel = (position, scale, intensity) => {
    const panel = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: new T.Color(intensity, intensity, intensity), side: T.DoubleSide }));
    panel.position.set(...position); panel.scale.set(...scale); panel.lookAt(0, 0, 0); studio.add(panel);
  };
  addPanel([0, 6, 1], [9, 2.8, 1], 5);
  addPanel([-4, 3, -4], [5, 3.5, 1], 3);
  addPanel([3, 2, 4], [7, .6, 1], 4);
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .025, .1, 30);
  scene.environment = environment.texture;
  studio.traverse(obj => { if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); } });
  pmrem.dispose();
  scene.add(new T.HemisphereLight(0xdce9f4, 0x44403a, 2));
  const key = new T.DirectionalLight(0xf5f1e9, 4.2); key.position.set(-3, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.normalBias = .035; key.shadow.bias = -.0002; scene.add(key);
  const rim = new T.DirectionalLight(0xa9c8eb, 2.1); rim.position.set(3, 3, -5); scene.add(rim);
  const warm = new T.DirectionalLight(0xff9970, .7); warm.position.set(5, 2, 4); scene.add(warm);
  const floor = new T.Mesh(new T.PlaneGeometry(150, 150), new T.ShadowMaterial({ color: 0x000000, opacity: .28 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.015; floor.receiveShadow = true; scene.add(floor);
  const contactCanvas = document.createElement('canvas'); contactCanvas.width = 128; contactCanvas.height = 128;
  const ctx = contactCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64,64,3,64,64,64); gradient.addColorStop(0,'rgba(0,0,0,.65)'); gradient.addColorStop(.55,'rgba(0,0,0,.3)'); gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  const contact = new T.Mesh(new T.PlaneGeometry(7, 3.8), new T.MeshBasicMaterial({ map: new T.CanvasTexture(contactCanvas), transparent: true, depthWrite: false, opacity: .7 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = .005; scene.add(contact);

  function group(id, offset) {
    const node = new T.Group(); node.userData.part = id;
    node.userData.rest = new T.Vector3(); node.userData.offset = new T.Vector3(...offset);
    model.add(node); (parts[id] ||= []).push(node); return node;
  }
  function mesh(geometry, material, parent, position = [0,0,0], rotation = [0,0,0]) {
    const object = new T.Mesh(geometry, material); object.position.set(...position); object.rotation.set(...rotation);
    object.castShadow = true; object.receiveShadow = true; parent.add(object);
    let node = parent; while (node && !node.userData.part) node = node.parent;
    if (node) { object.userData.part = node.userData.part; clickable.push(object); }
    return object;
  }
  const box = (size, material, parent, pos, rot) => mesh(new T.BoxGeometry(...size), material, parent, pos, rot);
  const cyl = (r1, r2, height, material, parent, pos, rot = [Math.PI/2,0,0], segments = 32) => mesh(new T.CylinderGeometry(r1,r2,height,segments), material,parent,pos,rot);
  function line(points, material, parent, radius = .014) {
    const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    return mesh(new T.TubeGeometry(path, Math.max(8,points.length*6), radius, 6, false),material,parent);
  }
  function surface(points, material, parent) {
    const geometry = new T.BufferGeometry();
    const flat = points.flat(); geometry.setAttribute('position',new T.Float32BufferAttribute(flat,3));
    const indices = []; for (let i=1;i<points.length-1;i++) indices.push(0,i,i+1);
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(geometry,material,parent);
  }
  // Body sections: [longitudinal position, half-width, top, bottom].
  function loft(sections, material, parent, cabin = false) {
    const positions = [], indices = [];
    const profile = cabin ? [[0,1],[.7,.94],[1,.35],[1,0],[0,0],[-1,0],[-1,.35],[-.7,.94]] : [[0,1],[.6,.98],[.91,.85],[1,.58],[.99,.15],[.78,0],[0,0],[-.78,0],[-.99,.15],[-1,.58],[-.91,.85],[-.6,.98]];
    const n = profile.length;
    for (const [x,w,top,bottom] of sections) for (const [z,y] of profile) positions.push(x,bottom+(top-bottom)*y,w*z);
    for (let i=0;i<sections.length-1;i++) for (let j=0;j<n;j++) {
      const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+j,d=(i+1)*n+(j+1)%n;
      indices.push(a,b,c,b,d,c);
    }
    for (let i=1;i<n-1;i++) { indices.push(0,i+1,i); const k=(sections.length-1)*n; indices.push(k,k+i,k+i+1); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position',new T.Float32BufferAttribute(positions,3)); geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo,material,parent);
  }
  const body = group('body', [0, 1.8, -.25]);
  loft([[-2.6,.70,.69,.36],[-2.43,.93,.80,.34],[-2.03,1.02,.98,.38],[-1.6,1.06,1.04,.4],[-1.08,.98,.97,.39],[-.45,.96,.93,.37],[.3,.98,.94,.37],[1.02,1.04,1.02,.4],[1.64,1.08,1.07,.4],[2.16,1,.97,.4],[2.5,.9,.81,.42],[2.56,.8,.72,.43]],paint,body);
  // Sculpted hood creases, sill blades, side intakes and wheel surrounds.
  for (const side of [-1,1]) {
    line([[-2.42,.79,.47*side],[-1.85,1.018,.53*side],[-1.1,.98,.57*side],[-.85,.975,.62*side]],graphite,body,.007);
    line([[-2.38,.45,.94*side],[-1.15,.38,1.02*side],[.5,.37,1.03*side],[2.23,.45,.99*side]],carbon,body,.038);
    surface([[.35,.89,1.001*side],[1.18,.96,1.053*side],[.86,.54,1.053*side],[.44,.5,1.004*side]],new T.MeshStandardMaterial({ color:0x060d12,roughness:.6,side:T.DoubleSide }),body);
    for (let j=0;j<3;j++) box([.035,.29,.025],graphite,body,[.68+j*.12,.71,(1.058-j*.004)*side],[0,0,-.3]);
    line([[-.9,.94,.96*side],[-.93,.54,.99*side],[-.75,.45,1.01*side],[.23,.45,1.02*side],[.42,.9,.99*side]],dark,body,.008);
    box([.17,.018,.025],graphite,body,[.05,.89,.991*side]);
    // Side mirrors on narrow carbon arms.
    box([.21,.024,.04],carbon,body,[-.75,1.1,1.02*side],[0,side*.4,0]);
    const mirror=mesh(new T.SphereGeometry(1,16,8),paint,body,[-.78,1.14,1.14*side]);mirror.scale.set(.16,.065,.10);
    box([.023,.055,.12],glass,body,[-.64,1.14,1.14*side]);
    for (let j=0;j<4;j++) box([.045,.014,.23],dark,body,[1.35+j*.11,1.077,.69*side],[0,0,.04]);
    // Swept thin LED headlight signatures.
    line([[-2.5,.73,.54*side],[-2.28,.827,.73*side],[-2.04,.912,.85*side]],dark,body,.035);
    line([[-2.52,.769,.54*side],[-2.29,.865,.73*side],[-2.04,.950,.85*side]],light,body,.013);
    line([[-2.52,.750,.57*side],[-2.30,.848,.76*side]],light,body,.008);
    // Vertical cooling apertures and rear vents.
    box([.06,.12,.27],dark,body,[-2.53,.51,.62*side],[0,0,.16]);
    for(let j=0;j<4;j++) box([.035,.14,.028],graphite,body,[-2.57,.52,(.53+j*.06)*side]);
    line([[2.53,.72,.79*side],[2.58,.74,.4*side],[2.59,.74,0]],rearLight,body,.019);
  }
  box([.06,.12,.7],dark,body,[-2.60,.51,0]);
  // Cockpit remains part of the lifted body, leaving seats visible beneath.
  const cabin = new T.Group(); cabin.scale.y = .66; cabin.position.y = .93 * .34; body.add(cabin);
  loft([[-1.04,.7,.97,.92],[-.67,.73,1.34,.94],[-.18,.70,1.62,.95],[.50,.68,1.64,.96],[1.05,.72,1.25,.95],[1.32,.72,1.04,.97]],glass,cabin,true);
  loft([[-.25,.57,1.636,1.60],[.05,.59,1.677,1.62],[.48,.57,1.658,1.62],[.64,.55,1.56,1.53]],paint,cabin,true);
  for (const side of [-1,1]) {
    line([[-1.07,.975,.68*side],[-.67,1.36,.69*side],[-.21,1.63,.53*side],[.48,1.65,.52*side],[1.12,1.21,.7*side],[1.35,1.03,.71*side]],paint,cabin,.018);
    line([[.43,1.62,.59*side],[.62,1.04,.73*side]],carbon,cabin,.025);
    line([[-1.04,.97,.71*side],[.08,.97,.75*side],[1.32,1.03,.73*side]],graphite,cabin,.017);
  }
  box([.06,.035,.09],orange,body,[-2.15,.98,0],[0,0,-.18]);
  // The fixed centre tub, suspension and interior form an independent assembly.
  const chassis = group('chassis', [0, .07, 0]);
  loft([[-2.24,.64,.38,.24],[-1.2,.79,.46,.24],[.75,.80,.45,.24],[2.22,.63,.45,.27]],carbon,chassis);
  box([1.55,.24,1.39],carbon,chassis,[-.05,.56,0]);
  for(const side of [-1,1]) {
    box([2.9,.17,.13],graphite,chassis,[0,.55,.73*side]);
    for (const axle of [-1.65,1.65]) {
      line([[axle-.18,.42,.62*side],[axle,.52,1.04*side],[axle+.2,.42,.62*side]],silver,chassis,.027);
      cyl(.055,.055,.27,orange,chassis,[axle,.65,.84*side],[0,0,.35*side],12);
    }
    const seat=mesh(new T.SphereGeometry(1,16,12),dark,chassis,[.12,.87,.36*side],[0,0,.22]);seat.scale.set(.12,.34,.23);
    const cushion=mesh(new T.SphereGeometry(1,16,8),dark,chassis,[-.12,.62,.36*side]);cushion.scale.set(.30,.10,.23);
    line([[-.3,.7,.15*side],[.02,1.13,.15*side],[.25,1.18,.16*side]],orange,chassis,.017);
  }
  box([.22,.21,1.24],dark,chassis,[-.66,.9,0]);
  const steering = mesh(new T.TorusGeometry(.145,.018,8,24),graphite,chassis,[-.54,1.0,.37],[0,Math.PI/2-.3,0]);
  box([.01,.1,.23],dark,chassis,[-.54,1.0,.37],[0,0,-.3]);
  // Mid-mounted V8 engine with eight cylinders and visible intake runners.
  const engine = group('engine', [1.1,.72,.91]); engine.userData.rest.y = -.14;
  box([1.02,.36,.68],graphite,engine,[1.34,.72,0]);
  box([.86,.12,.62],silver,engine,[1.34,.95,0]);
  for(const side of [-1,1]) {
    box([.95,.15,.20],carbon,engine,[1.30,1.04,.24*side],[side*.3,0,0]);
    for(let j=0;j<4;j++) {
      cyl(.09,.08,.33,silver,engine,[1.0+j*.2,.81,.28*side],[side*.5,0,0],12);
      line([[1.01+j*.2,1.03,.13*side],[1.01+j*.2,1.16,.27*side],[1.01+j*.2,.9,.47*side]],graphite,engine,.033);
    }
    line([[1.45,.59,.33*side],[1.95,.51,.45*side],[2.46,.51,.48*side]],silver,engine,.065);
    cyl(.105,.105,.22,carbon,engine,[2.47,.5,.48*side],[0,0,Math.PI/2]);
    box([.56,.012,.025],orange,engine,[1.32,1.125,.23*side]);
  }
  box([.19,.16,.5],silver,engine,[1.97,.65,0]);
  // Four fully modelled wheels, each translated along its own axle when exploded.
  for(const x of [-1.65,1.65]) for(const side of [-1,1]) {
    const wheel = group('wheels',[x < 0 ? -.14 : .14,.12,side*1.02]);
    const z = side*1.02, y=.49;
    mesh(new T.TorusGeometry(.362,.115,12,48),rubber,wheel,[x,y,z]);
    cyl(.34,.34,.21,graphite,wheel,[x,y,z]);
    const outer=z+side*.115;
    mesh(new T.TorusGeometry(.316,.018,8,40),silver,wheel,[x,y,outer]);
    cyl(.245,.245,.017,silver,wheel,[x,y,outer-side*.045]);
    // Drilled rotor marks are actual geometry, not textures.
    for(let j=0;j<12;j++) { const a=j*Math.PI/6; cyl(.009,.009,.019,dark,wheel,[x+Math.cos(a)*.205,y+Math.sin(a)*.205,outer-side*.032],undefined,6); }
    box([.075,.19,.055],orange,wheel,[x+.18,y+.015,outer-side*.02],[0,0,-.3]);
    for(let j=0;j<5;j++) {
      const a=j*Math.PI*2/5;
      box([.048,.29,.038],silver,wheel,[x-Math.sin(a)*.16,y+Math.cos(a)*.16,outer],[0,0,a+.13]);
      box([.018,.26,.035],graphite,wheel,[x-Math.sin(a+.19)*.17,y+Math.cos(a+.19)*.17,outer+.006*side],[0,0,a+.24]);
    }
    cyl(.076,.076,.05,graphite,wheel,[x,y,outer+side*.01]);
    cyl(.035,.035,.055,silver,wheel,[x,y,outer+side*.015]);
    for(let j=0;j<5;j++) {const a=j*Math.PI*2/5;cyl(.011,.011,.055,silver,wheel,[x+Math.cos(a)*.052,y+Math.sin(a)*.052,outer+side*.012],undefined,6);}
    // Sidewall rings catch the studio light.
    mesh(new T.TorusGeometry(.416,.004,4,48),graphite,wheel,[x,y,z+side*.08]);
  }
  const frontAero = group('aero',[-.48,-.02,0]);
  loft([[-2.72,.72,.32,.28],[-2.55,1.03,.34,.27],[-1.9,1.08,.34,.3]],carbon,frontAero);
  const rearAero = group('aero',[.55,2.05,0]);
  box([.35,.065,2.08],carbon,rearAero,[2.17,1.27,0],[0,0,-.09]);
  for(const side of [-1,1]) {
    box([.06,.3,.04],graphite,rearAero,[2.17,1.1,.6*side],[0,0,-.18]);
    box([.38,.16,.025],carbon,rearAero,[2.18,1.29,1.03*side],[0,0,-.1]);
    box([.30,.012,.032],orange,rearAero,[2.18,1.37,1.045*side],[0,0,-.1]);
  }
  const diffuser = group('aero',[.5,-.04,0]);
  box([.7,.08,1.8],carbon,diffuser,[2.27,.3,0],[0,0,.12]);
  for(let j=0;j<6;j++) box([.6,.13,.025],carbon,diffuser,[2.24,.3,-.75+j*.3],[0,0,.12]);

  // An unobtrusive floor ring anchors the vehicle within the virtual studio.
  const ringPoints=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI*2;ringPoints.push(new T.Vector3(Math.cos(a)*3.7,.012,Math.sin(a)*2.35));}
  const floorRing = new T.Line(new T.BufferGeometry().setFromPoints(ringPoints),new T.LineBasicMaterial({color:0x505b60,transparent:true,opacity:.16}));scene.add(floorRing);
  const raycaster = new T.Raycaster(), mouse = new T.Vector2();
  let pointerStart = null, lastPointerX = 0, dragged = false;
  host.addEventListener('pointerdown', event => {
    if(event.pointerType === 'touch') return;
    pointerStart = { x:event.clientX, y:event.clientY }; lastPointerX=event.clientX; dragged=false;
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove', event => {
    if(!pointerStart) return;
    if(Math.abs(event.clientX-pointerStart.x)>4) dragged=true;
    if(dragged) { state.targetRotation+=(event.clientX-lastPointerX)*.006; state.interactive=true; needsRender=true; }
    lastPointerX=event.clientX;
  });
  host.addEventListener('pointerup', event => {
    if(!dragged) {
      const rect=host.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(clickable,false)[0];
      if(hit && state.exploded) window.dispatchEvent(new CustomEvent('aurel:part',{detail:hit.object.userData.part}));
    }
    pointerStart=null;dragged=false;
  });
  host.addEventListener('pointercancel',()=>{pointerStart=null;dragged=false;});
  const compact=()=>host.clientWidth<761;
  function resize() {
    const w=activeHost.clientWidth,h=activeHost.clientHeight;
    if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    const halfHeight=Math.max(.95,3.35/(w/h));detailCamera.top=halfHeight;detailCamera.bottom=-halfHeight;detailCamera.left=-halfHeight*w/h;detailCamera.right=halfHeight*w/h;detailCamera.updateProjectionMatrix();
    needsRender=true;
  }
  const sizeObserver=new ResizeObserver(resize);slots.forEach(slot=>sizeObserver.observe(slot.element));resize();
  const visibilityObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)slots.find(slot=>slot.element===entry.target).visible=entry.isIntersecting;
    const slot=slots.find(item=>item.visible);state.visible=Boolean(slot);
    if(slot&&slot.element!==activeHost){activeHost=slot.element;activeView=slot.id;activeHost.appendChild(renderer.domElement);resize();}
    needsRender=true;
  },{rootMargin:'80px'});slots.forEach(slot=>visibilityObserver.observe(slot.element));
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();state.visible=false;fail();});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{window.location.reload();});
  let last=0, explosion=0, angle=-.78;
  const targetCamera=new T.Vector3(),lookAt=new T.Vector3(),highlightColor=new T.Color(0x8a3718);
  const partMaterials = {};
  for(const object of clickable) {
    // Clone emissive materials per assembly, allowing accessible selection highlighting.
    const keyName = object.userData.part + '-' + object.material.uuid;
    if(!partMaterials[keyName]) { const original=object.material; const clone=original.clone(); clone.userData.baseEmission=clone.emissive.clone(); clone.userData.baseIntensity=clone.emissiveIntensity; partMaterials[keyName]=clone; if(original===paint) paintMaterials.push(clone); }
    object.material=partMaterials[keyName];
  }
  function frame(time) {
    requestAnimationFrame(frame);
    if(!state.visible || document.hidden) {last=time;return;}
    const dt=Math.min((time-last)/1000,.05);if(dt<1/45)return;last=time;
    const isMain=activeView==='main';
    const viewAngles={front:-.78,side:.015,rear:2.40};
    const finale=Math.max(0,(state.progress-.82)/.18);
    const targetAngle=viewAngles[state.view]+(state.paused?0:state.progress*.95+finale*finale*(3-2*finale)*1.5);
    if(!needsRender&&Math.abs(Number(state.exploded)-explosion)<.0002&&Math.abs(state.targetRotation-state.rotation)<.0002&&Math.abs(targetAngle-angle)<.0002)return;
    needsRender=false;
    const ease=state.paused?1:1-Math.exp(-dt*4.1);
    explosion+=(Number(state.exploded)-explosion)*ease;
    state.rotation+=(state.targetRotation-state.rotation)*ease;
    const displayedExplosion=isMain?explosion:0;
    for(const groups of Object.values(parts)) for(const node of groups) {
      node.position.copy(node.userData.rest).addScaledVector(node.userData.offset,displayedExplosion);
      node.rotation.x=node.userData.part==='body'?-.025*displayedExplosion:0;
    }
    if(state.drive==='pista')rearAero.position.y+=.13*(1-displayedExplosion);
    for(const [keyName,mat] of Object.entries(partMaterials)) {
      const selected=isMain&&keyName.startsWith(state.selected+'-')&&explosion>.3;
      mat.emissive.copy(mat.userData.baseEmission);
      if(selected)mat.emissive.lerp(highlightColor,.18);
      mat.emissiveIntensity=mat.userData.baseIntensity;
    }
    angle+=(targetAngle-angle)*ease;
    const mobile=compact();
    const radius=(mobile?23:10.3)+(mobile?7:4.2)*explosion;
    // Rotate the vehicle, not the page, and preserve a stable reading area.
    model.rotation.y=isMain?state.rotation:0;
    targetCamera.set(Math.sin(angle)*radius, (mobile?7.4:4.15)+explosion*(mobile?3:1.25),Math.cos(angle)*radius);
    camera.position.copy(targetCamera);
    const aimY=mobile?(1.16+explosion*.5):(1.02+explosion*.44);
    lookAt.set(mobile?0:-.12,aimY,0);camera.lookAt(lookAt);
    // Raise the visual in the mobile viewport to leave room for copy and part details.
    camera.setViewOffset(host.clientWidth,host.clientHeight,0,host.clientHeight*(mobile ? (.025+explosion*.065) : (.08-explosion*.095)),host.clientWidth,host.clientHeight);
    contact.material.opacity=.7-displayedExplosion*.32;
    floorRing.material.opacity=.16+explosion*.12;
    floorRing.visible=isMain;
    if(isMain)renderer.render(scene,camera);
    else{
      detailCamera.position.set(activeView==='aero'?-.18:-6,activeView==='aero'?1.5:3.1,10);
      detailCamera.lookAt(0,.7,0);renderer.render(scene,detailCamera);
    }
  }
  window.AurelCar={
    setExploded(value){state.exploded=value;needsRender=true;},
    select(id){if(parts[id]){state.selected=id;needsRender=true;}},
    setProgress(value){if(state.progress!==value){state.progress=value;needsRender=true;}},
    setView(view){if(['front','side','rear'].includes(view)){state.view=view;state.targetRotation=0;needsRender=true;}},
    setPaused(value){state.paused=value;needsRender=true;},
    setColor(name){if(name in color){paintMaterials.forEach(mat=>mat.color.setHex(color[name]));needsRender=true;}},
    setDrive(value){state.drive=value;needsRender=true;},
    getState(){return {exploded:state.exploded,selected:state.selected,view:state.view,color:paintMaterials[0].color.getHexString(),visible:state.visible};}
  };
  loader.hidden=true;document.documentElement.classList.add('has-webgl');
  requestAnimationFrame(frame);
})();
