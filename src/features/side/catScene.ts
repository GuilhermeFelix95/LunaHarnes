import * as THREE from "three";

/// Cena 3D do gatinho lunar. Carregada sob demanda (import dinâmico em LunaCat.tsx), para o three.js
/// não pesar a abertura do app. Tudo é montado em código, sem arquivos de modelo.
/// Visual: gatinho roxo de traços arredondados, olhos grandes com brilho, laço no pescoço (prévia C).

const FUR = 0xa78bfa;
const FUR_DARK = 0x7c5ce0;
const CREAM = 0xf3edff;
const PINK = 0xffb3d1;
const BLUSH = 0xff8fb3;
const BOW = 0xff6b8b;
const PUPIL = 0x2d2350;
const STAR = 0xffd66b;

/// Cor da tela do notebook: o --accent do tema. Se o valor não der para ler, fica um lilás.
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a52, 1.6));
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

  const furMat = new THREE.MeshStandardMaterial({ color: FUR, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: FUR_DARK, roughness: 0.75 });
  const creamMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.6 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.6 });
  const blushMat = new THREE.MeshStandardMaterial({ color: BLUSH, roughness: 0.8, transparent: true, opacity: 0.85 });
  const bowMat = new THREE.MeshStandardMaterial({ color: BOW, roughness: 0.5 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: PUPIL, roughness: 0.3 });
  const starMat = new THREE.MeshStandardMaterial({ color: STAR, emissive: STAR, emissiveIntensity: 0.6 });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d2a,
    emissive: moonColor(),
    emissiveIntensity: 0.4,
  });
  const laptopMat = new THREE.MeshStandardMaterial({ color: 0x3a3450, roughness: 0.6 });

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = true;
    parent.add(item);
    return item;
  };

  const cat = new THREE.Group();
  scene.add(cat);

  // Corpo redondo e baixinho, com barriga creme.
  const body = mesh(new THREE.SphereGeometry(1, 40, 28), furMat, cat);
  body.scale.set(0.85, 0.66, 0.9);
  body.position.set(0, -0.35, 0);
  const belly = mesh(new THREE.SphereGeometry(1, 32, 20), creamMat, cat);
  belly.scale.set(0.5, 0.4, 0.28);
  belly.position.set(0, -0.5, 0.72);

  // Patas traseiras, arredondadas.
  const haunches = [-0.5, 0.5].map((x) => {
    const haunch = mesh(new THREE.SphereGeometry(0.38, 24, 18), darkMat, cat);
    haunch.position.set(x, -0.62, -0.18);
    return haunch;
  });

  // Cabeça grande, como a de um mascote.
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.5);
  cat.add(head);
  mesh(new THREE.SphereGeometry(0.62, 40, 30), furMat, head).scale.set(1, 0.92, 0.95);
  for (const x of [-0.4, 0.4]) {
    const ear = mesh(new THREE.ConeGeometry(0.2, 0.44, 20), furMat, head);
    ear.position.set(x, 0.5, 0);
    ear.rotation.z = -x * 0.55;
    const inner = mesh(new THREE.ConeGeometry(0.11, 0.24, 16), pinkMat, head);
    inner.position.set(x, 0.46, 0.1);
    inner.rotation.z = -x * 0.55;
  }
  mesh(new THREE.SphereGeometry(0.28, 28, 20), creamMat, head).position.set(0, -0.15, 0.46);
  mesh(new THREE.SphereGeometry(0.06, 16, 12), pinkMat, head).position.set(0, -0.02, 0.66);

  // Bochechas.
  for (const x of [-0.36, 0.36]) {
    const blush = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), blushMat, head);
    blush.rotation.x = Math.PI / 2;
    blush.position.set(x, -0.1, 0.56);
  }

  // Laço no pescoço: dois triângulos e um nó.
  const bow = new THREE.Group();
  bow.position.set(0, -0.56, 0.42);
  head.add(bow);
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.ConeGeometry(0.16, 0.24, 20), bowMat, bow);
    wing.position.set(side * 0.17, 0, 0);
    wing.rotation.z = side * (Math.PI / 2);
  }
  mesh(new THREE.SphereGeometry(0.06, 16, 12), bowMat, bow);

  // Estrelinha na testa, acesa.
  mesh(new THREE.OctahedronGeometry(0.07, 0), starMat, head).position.set(0.42, 0.42, 0.28);

  // Olhos grandes com brilho (abertos) e arcos felizes (fechados).
  const openEyes = new THREE.Group();
  const closedEyes = new THREE.Group();
  head.add(openEyes, closedEyes);
  for (const x of [-0.24, 0.24]) {
    mesh(new THREE.SphereGeometry(0.19, 24, 18), whiteMat, openEyes).position.set(x, 0.04, 0.48);
    mesh(new THREE.SphereGeometry(0.12, 20, 16), pupilMat, openEyes).position.set(x, 0.02, 0.6);
    mesh(new THREE.SphereGeometry(0.045, 12, 10), whiteMat, openEyes).position.set(x + 0.06, 0.09, 0.67);

    const arc = mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 20, Math.PI), pupilMat, closedEyes);
    arc.position.set(x, -0.01, 0.66);
  }
  closedEyes.visible = false;

  // Focinho e boca.
  const mouth = mesh(new THREE.TorusGeometry(0.08, 0.018, 10, 18, Math.PI), pupilMat, head);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.26, 0.62);

  // Bigodes finos.
  for (const side of [-1, 1]) {
    for (const angle of [-0.12, 0.12]) {
      const whisker = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6), pupilMat, head);
      whisker.rotation.z = side * (Math.PI / 2 + angle);
      whisker.position.set(side * 0.55, -0.16, 0.5);
    }
  }

  const paws = [-0.26, 0.26].map((x) => {
    const paw = mesh(new THREE.CapsuleGeometry(0.12, 0.2, 8, 16), furMat, cat);
    paw.rotation.x = Math.PI / 2;
    paw.position.set(x, -0.8, 0.9);
    return paw;
  });

  // Cauda grossinha, enrolada para cima.
  const tail = new THREE.Group();
  cat.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.7, -0.8),
    new THREE.Vector3(0, -0.8, -1.6),
    new THREE.Vector3(0.5, -0.8, -1.9),
    new THREE.Vector3(0.95, -0.4, -1.6),
    new THREE.Vector3(1.05, 0.25, -1.2),
  ]);
  mesh(new THREE.TubeGeometry(tailCurve, 40, 0.14, 14, false), furMat, tail);

  // Notebook aberto à frente, com a tela voltada para o gato.
  const laptop = new THREE.Group();
  laptop.position.set(0, -1.0, 2.3);
  laptop.scale.setScalar(0.75);
  scene.add(laptop);
  mesh(new THREE.BoxGeometry(1.6, 0.06, 1.1), laptopMat, laptop).position.set(0, 0, -0.55);
  const lid = new THREE.Group();
  lid.position.set(0, 0, -1.05);
  lid.rotation.x = -0.2;
  laptop.add(lid);
  mesh(new THREE.BoxGeometry(1.35, 0.9, 0.05), laptopMat, lid).position.set(0, 0.45, 0);
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

    head.rotation.x = working ? 0.25 + 0.03 * Math.sin(t * 2) : 0.45;
    head.position.y = working ? 0.6 : 0.46;
    openEyes.visible = working;
    closedEyes.visible = !working;
    body.scale.y = working ? 0.66 : 0.6 + 0.02 * Math.sin(t * 1.8);
    tail.rotation.y = working ? 0.35 * Math.sin(t * 3) : 1.1;
    paws.forEach((paw, i) => {
      paw.position.y = working ? -0.8 + 0.04 * Math.abs(Math.sin(t * 16 + i * Math.PI)) : -0.84;
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
