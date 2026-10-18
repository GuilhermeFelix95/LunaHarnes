import * as THREE from "three";

/// Cena 3D do gatinho lunar. Carregada sob demanda (import dinâmico em LunaCat.tsx), para o three.js
/// não pesar a abertura do app. Tudo é montado em código, sem arquivos de modelo.

const FUR = 0x8f8a9c;
const FUR_DARK = 0x4f4c5e;
const FUR_LIGHT = 0xb4afc2;
const EYE = 0x9fe6c2;
const NOSE = 0xe59aa8;

/// Cor da lua: o --accent do tema. Se o valor não der para ler, fica um lilás.
function moonColor(): THREE.Color {
  const color = new THREE.Color(0xc9a6ff);
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  if (value) color.setStyle(value);
  return color;
}

function zSprite(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#9aa0c4";
    ctx.font = "bold 46px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("z", 32, 36);
  }
  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  return new THREE.Sprite(material);
}

/// Monta a cena dentro de `host`. `isWorking` é lido a cada quadro. Devolve a função que desmonta tudo.
export function mountCatScene(host: HTMLElement, isWorking: () => boolean): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.4, 8.5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a52, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 48),
    new THREE.ShadowMaterial({ opacity: 0.22 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  floor.receiveShadow = true;
  scene.add(floor);

  const furMat = new THREE.MeshStandardMaterial({ color: FUR, roughness: 0.92 });
  const lightMat = new THREE.MeshStandardMaterial({ color: FUR_LIGHT, roughness: 0.92 });
  const darkMat = new THREE.MeshStandardMaterial({ color: FUR_DARK, roughness: 0.95 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE, emissive: EYE, emissiveIntensity: 0.7 });
  const noseMat = new THREE.MeshStandardMaterial({ color: NOSE, roughness: 0.6 });
  const moonMat = new THREE.MeshStandardMaterial({
    color: moonColor(),
    emissive: moonColor(),
    emissiveIntensity: 1.2,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d2a,
    emissive: moonColor(),
    emissiveIntensity: 0.4,
  });

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = true;
    parent.add(item);
    return item;
  };

  const cat = new THREE.Group();
  scene.add(cat);

  const body = mesh(new THREE.SphereGeometry(1, 32, 24), furMat, cat);
  body.scale.set(0.95, 0.7, 1.1);
  body.position.set(0, -0.15, 0);

  const haunches = [-0.45, 0.45].map((x) => {
    const haunch = mesh(new THREE.SphereGeometry(0.36, 24, 16), darkMat, cat);
    haunch.position.set(x, -0.6, -0.25);
    return haunch;
  });

  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.55);
  cat.add(head);
  mesh(new THREE.SphereGeometry(0.5, 32, 24), furMat, head).scale.set(1, 0.9, 0.95);
  for (const x of [-0.3, 0.3]) {
    const ear = mesh(new THREE.ConeGeometry(0.18, 0.36, 16), furMat, head);
    ear.position.set(x, 0.42, -0.05);
    ear.rotation.z = -x * 0.6;
  }
  mesh(new THREE.SphereGeometry(0.2, 24, 16), lightMat, head).position.set(0, -0.12, 0.42);
  mesh(new THREE.SphereGeometry(0.05, 16, 12), noseMat, head).position.set(0, -0.04, 0.6);

  // Lua crescente na testa: uma esfera acesa com outra, da cor do pelo, cobrindo parte dela.
  mesh(new THREE.SphereGeometry(0.1, 20, 14), moonMat, head).position.set(0, 0.36, 0.47);
  mesh(new THREE.SphereGeometry(0.095, 20, 14), furMat, head).position.set(0.045, 0.37, 0.5);

  const openEyes = new THREE.Group();
  const closedEyes = new THREE.Group();
  head.add(openEyes, closedEyes);
  for (const x of [-0.2, 0.2]) {
    const eye = mesh(new THREE.SphereGeometry(0.07, 16, 12), eyeMat, openEyes);
    eye.position.set(x, 0.05, 0.44);
    eye.scale.set(1, 1.3, 0.5);
    const lid = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), darkMat, closedEyes);
    lid.position.set(x, 0.05, 0.46);
  }
  closedEyes.visible = false;

  const paws = [-0.24, 0.24].map((x) => {
    const paw = mesh(new THREE.CapsuleGeometry(0.1, 0.22, 6, 12), lightMat, cat);
    paw.rotation.x = Math.PI / 2;
    paw.position.set(x, -0.78, 0.85);
    return paw;
  });

  const tail = new THREE.Group();
  cat.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.7, -0.8),
    new THREE.Vector3(0, -0.8, -1.6),
    new THREE.Vector3(0.5, -0.8, -1.9),
    new THREE.Vector3(0.9, -0.4, -1.6),
    new THREE.Vector3(1.0, 0.2, -1.2),
  ]);
  mesh(new THREE.TubeGeometry(tailCurve, 40, 0.09, 10, false), furMat, tail);

  // Notebook aberto à frente, com a tela voltada para o gato.
  const laptop = new THREE.Group();
  laptop.position.set(0, -0.86, 2.3);
  scene.add(laptop);
  mesh(new THREE.BoxGeometry(1.6, 0.06, 1.1), darkMat, laptop).position.set(0, 0, -0.55);
  const lid = new THREE.Group();
  lid.position.set(0, 0, -1.05);
  lid.rotation.x = -0.2;
  laptop.add(lid);
  mesh(new THREE.BoxGeometry(1.35, 0.9, 0.05), darkMat, lid).position.set(0, 0.45, 0);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), screenMat);
  screen.position.set(0, 0.45, -0.03);
  screen.rotation.y = Math.PI;
  lid.add(screen);

  const zs = [0, 0.4].map(() => {
    const sprite = zSprite();
    scene.add(sprite);
    return sprite;
  });

  // Pose de trabalho e de sono. Cada quadro aplica a pose atual sobre a anterior.
  const frame = (t: number) => {
    const working = isWorking();

    head.rotation.x = working ? 0.25 + 0.03 * Math.sin(t * 2) : 0.5;
    head.position.y = working ? 0.55 : 0.42;
    openEyes.visible = working;
    closedEyes.visible = !working;
    body.scale.y = working ? 0.7 : 0.62 + 0.02 * Math.sin(t * 1.8);
    tail.rotation.y = working ? 0.35 * Math.sin(t * 3) : 1.1;
    paws.forEach((paw, i) => {
      paw.position.y = working ? -0.78 + 0.04 * Math.abs(Math.sin(t * 16 + i * Math.PI)) : -0.82;
    });
    haunches.forEach((haunch) => (haunch.scale.y = working ? 1 : 0.9));

    const blink = Math.sin(t * 6) > 0.85;
    screenMat.emissiveIntensity = working ? (blink ? 0.15 : 0.5) : 0.08;

    zs.forEach((sprite, i) => {
      const material = sprite.material as THREE.SpriteMaterial;
      const phase = (t / 2.4 + i * 0.5) % 1;
      sprite.visible = !working;
      sprite.position.set(0.95 + i * 0.35, 0.9 + phase * 1.2, 0.2);
      sprite.scale.setScalar(0.35 + phase * 0.2);
      material.opacity = working ? 0 : Math.sin(Math.PI * phase) * 0.9;
    });

    camera.position.x = 0.6 * Math.sin(t * 0.25);
    camera.lookAt(0, 0.4, 0);
    renderer.render(scene, camera);
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    frame(clock.getElapsedTime());
  };
  const start = () => {
    if (raf || reduced) return;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (reduced) frame(0);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const visibility = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden) start();
    else stop();
  });
  visibility.observe(host);
  const onVisibilityChange = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (reduced) frame(0);
  else start();

  return () => {
    stop();
    resizeObserver.disconnect();
    visibility.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    scene.traverse((item) => {
      if (item instanceof THREE.Mesh) item.geometry.dispose();
      if (item instanceof THREE.Mesh || item instanceof THREE.Sprite) {
        const material = item.material as THREE.Material & { map?: THREE.Texture | null };
        material.map?.dispose();
        material.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
