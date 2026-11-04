import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CompetitorCount, MatchState, SportDiscipline } from '../game/rules';

interface ThreeRaceViewportProps {
  matchRef: React.MutableRefObject<MatchState>;
  previewSport: SportDiscipline;
  previewCompetitorCount?: CompetitorCount;
  isTitleScreen: boolean;
}

// Module-scope reusable scratch objects (Zero GC inside render loop)
const _camTargetPos = new THREE.Vector3();
const _camLookAtPos = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 1.5, -12);
const _dummyObj = new THREE.Object3D();
const _instanceColor = new THREE.Color();

const RIVAL_LIVERY_PALETTE: { primary: number; accent: number }[] = [
  { primary: 0xf43f5e, accent: 0x38bdf8 },
  { primary: 0xa855f7, accent: 0xf59e0b },
  { primary: 0x10b981, accent: 0x06b6d4 },
  { primary: 0xf97316, accent: 0x38bdf8 },
  { primary: 0x3b82f6, accent: 0xfacc15 },
  { primary: 0xec4899, accent: 0x2dd4bf },
  { primary: 0xeab308, accent: 0xf43f5e },
];

const RIVAL_SLOT_OFFSETS = [2.4, 0, -4.4, 4.4, -1.2, 1.2, 3.6];

function createTrackTexture(maxAnisotropy: number, isTrackField: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (isTrackField) {
    // Olympic terracotta / crimson tartan track surface
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle granule noise
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 900; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      ctx.fillRect(x, y, 3, 3);
    }

    // Crisp white multi-lane markings
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(16, 0, 5, 512);
    ctx.fillRect(138, 0, 5, 512);
    ctx.fillRect(254, 0, 5, 512);
    ctx.fillRect(372, 0, 5, 512);
    ctx.fillRect(490, 0, 5, 512);
  } else {
    // Grand Prix dark asphalt with FIA red/white curbs
    ctx.fillStyle = '#161f30';
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt micro-grain
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 800; i++) {
      const x = (i * 97) % 512;
      const y = (i * 193) % 512;
      ctx.fillRect(x, y, 3, 4);
    }

    // Red & white apex rumble curbs on left/right edges
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#ef4444' : '#f8fafc';
      ctx.fillRect(0, y, 22, 64);
      ctx.fillRect(490, y, 22, 64);
    }

    // Dashed multi-competitor lane dividers
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(136, y, 5, 34);
      ctx.fillRect(254, y, 5, 34);
      ctx.fillRect(372, y, 5, 34);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 36);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Composite 10-part Formula Prototype Race Car (THREE.Group)
 * Pivot is at bottom-center (y = 0) so wheels sit flush on track surface.
 */
function buildRaceCarGroup(primaryHex: number, accentHex: number): {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  boostFlame: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    metalness: 0.72,
    roughness: 0.24,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.4,
    roughness: 0.65,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.9,
    roughness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.5,
    roughness: 0.35,
    emissive: accentHex,
    emissiveIntensity: 0.25,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.15,
    roughness: 0.85,
  });

  // 1. Primary Silhouette: Sculpted ExtrudeGeometry Aero Chassis
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.75, 0);
  hullShape.lineTo(0.75, 0);
  hullShape.lineTo(0.55, 2.2);
  hullShape.lineTo(-0.55, 2.2);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.56, -1.1);
  const hullMesh = new THREE.Mesh(hullGeo, bodyMat);
  hullMesh.castShadow = true;
  root.add(hullMesh);

  // 2. Nose Cone (tapered forward wedge)
  const noseGeo = new THREE.BoxGeometry(0.85, 0.28, 1.35);
  const noseMesh = new THREE.Mesh(noseGeo, bodyMat);
  noseMesh.position.set(0, 0.34, -1.55);
  noseMesh.castShadow = true;
  root.add(noseMesh);

  // 3. Secondary Read: Glossy Cockpit Canopy Dome
  const canopyGeo = new THREE.SphereGeometry(0.46, 16, 12);
  canopyGeo.scale(1.0, 0.68, 1.65);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.72, -0.15);
  root.add(canopyMesh);

  // 4. Front Splitter Aero Wing
  const frontWingGeo = new THREE.BoxGeometry(1.85, 0.08, 0.42);
  const frontWing = new THREE.Mesh(frontWingGeo, accentMat);
  frontWing.position.set(0, 0.18, -2.15);
  root.add(frontWing);

  // 5. Rear Spoiler Struts + Elevated DRS Wing
  const rearWingGeo = new THREE.BoxGeometry(1.75, 0.1, 0.45);
  const rearWing = new THREE.Mesh(rearWingGeo, accentMat);
  rearWing.position.set(0, 1.05, 1.02);
  root.add(rearWing);

  const strutGeo = new THREE.BoxGeometry(0.08, 0.48, 0.28);
  const leftStrut = new THREE.Mesh(strutGeo, trimMat);
  leftStrut.position.set(-0.55, 0.8, 1.0);
  const rightStrut = new THREE.Mesh(strutGeo, trimMat);
  rightStrut.position.set(0.55, 0.8, 1.0);
  root.add(leftStrut, rightStrut);

  // 6-9. Four Multi-Read Racing Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions: [number, number, number][] = [
    [-0.92, 0.36, -1.35],
    [0.92, 0.36, -1.35],
    [-0.95, 0.38, 0.75],
    [0.95, 0.38, 0.75],
  ];
  const wheels: THREE.Mesh[] = [];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
    wMesh.position.set(wx, wy, wz);
    wMesh.castShadow = true;
    root.add(wMesh);
    wheels.push(wMesh);
  });

  // 10. Accent Detail: Afterburner Turbo Exhaust Cone
  const flameGeo = new THREE.ConeGeometry(0.26, 1.1, 12);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
  });
  const boostFlame = new THREE.Mesh(flameGeo, flameMat);
  boostFlame.position.set(0, 0.42, 1.65);
  root.add(boostFlame);

  // Soft Ground Contact Shadow Disc (y = 0.015)
  const shadowGeo = new THREE.CircleGeometry(1.45, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.015, -0.2);
  shadowDisc.scale.set(0.9, 1, 1.6);
  root.add(shadowDisc);

  return { root, wheels, boostFlame, bodyMat };
}

/**
 * Composite 9-part Articulated Olympic Sprinter Athlete (THREE.Group)
 */
function buildSprinterGroup(jerseyHex: number, accentHex: number): {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  torso: THREE.Mesh;
  jerseyMat: THREE.MeshStandardMaterial;
  auraRing: THREE.Mesh;
} {
  const root = new THREE.Group();

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: jerseyHex,
    metalness: 0.25,
    roughness: 0.55,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe2a77f,
    metalness: 0.08,
    roughness: 0.72,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.2,
    roughness: 0.8,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.85,
    roughness: 0.15,
    emissive: accentHex,
    emissiveIntensity: 0.3,
  });

  // 1. Torso
  const torsoGeo = new THREE.CapsuleGeometry(0.32, 0.68, 8, 12);
  const torso = new THREE.Mesh(torsoGeo, jerseyMat);
  torso.position.set(0, 1.45, 0);
  torso.castShadow = true;
  root.add(torso);

  // 2. Head + 3. Aerodynamic Sprint Visor
  const headGeo = new THREE.SphereGeometry(0.25, 16, 12);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 2.15, -0.05);
  root.add(head);

  const visorGeo = new THREE.BoxGeometry(0.42, 0.12, 0.32);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 2.18, -0.18);
  root.add(visor);

  // 4 & 5. Articulated Left & Right Arms
  const makeArm = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.44, 1.72, 0);
    const upperGeo = new THREE.CapsuleGeometry(0.1, 0.48, 6, 8);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    upper.position.set(0, -0.26, 0);
    armGroup.add(upper);
    root.add(armGroup);
    return armGroup;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // 6 & 7. Articulated Left & Right Legs + 8. Sprint Spikes
  const makeLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.2, 1.02, 0);
    const thighGeo = new THREE.CapsuleGeometry(0.13, 0.65, 6, 8);
    const thigh = new THREE.Mesh(thighGeo, shortsMat);
    thigh.position.set(0, -0.42, 0);

    const shoeGeo = new THREE.BoxGeometry(0.2, 0.14, 0.42);
    const shoe = new THREE.Mesh(shoeGeo, visorMat);
    shoe.position.set(0, -0.88, -0.08);
    legGroup.add(thigh, shoe);
    root.add(legGroup);
    return legGroup;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // 9. Speed Boost Ground Ring
  const ringGeo = new THREE.RingGeometry(0.65, 0.92, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
  });
  const auraRing = new THREE.Mesh(ringGeo, ringMat);
  auraRing.position.set(0, 0.025, 0);
  root.add(auraRing);

  // Ground Contact Shadow Disc
  const shadowGeo = new THREE.CircleGeometry(0.75, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.015, 0);
  root.add(shadowDisc);

  return { root, leftLeg, rightLeg, leftArm, rightArm, torso, jerseyMat, auraRing };
}

/**
 * Multi-part Championship Track Hurdle (THREE.Group)
 */
function buildHurdleGroup(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.75,
    roughness: 0.3,
  });
  const barMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.15,
    roughness: 0.4,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    metalness: 0.2,
    roughness: 0.45,
  });

  // Left & Right L-base feet + vertical posts
  [-0.95, 0.95].forEach((x) => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.7), metalMat);
    foot.position.set(x, 0.04, 0.25);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.08, 10), metalMat);
    post.position.set(x, 0.56, 0);
    group.add(foot, post);
  });

  // Top crossbar + high-contrast warning stripes
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.08), barMat);
  bar.position.set(0, 1.08, 0);
  const stripeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.17, 0.09), stripeMat);
  stripeLeft.position.set(-0.65, 1.08, 0);
  const stripeRight = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.17, 0.09), stripeMat);
  stripeRight.position.set(0.65, 1.08, 0);
  group.add(bar, stripeLeft, stripeRight);

  return group;
}

export const ThreeRaceViewport: React.FC<ThreeRaceViewportProps> = ({
  matchRef,
  previewSport,
  previewCompetitorCount = 4,
  isTitleScreen,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ previewSport, previewCompetitorCount, isTitleScreen });
  propsRef.current = { previewSport, previewCompetitorCount, isTitleScreen };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL from GPU renderer string (never user agent)
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x070b16);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x070b16, 0.0085);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 280);
    camera.position.set(0, 4.5, 8);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Studio PBR Environment Map (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Warm Key Light + Cool Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3d6, 1.65);
    keyLight.position.set(14, 24, 16);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      const d = 18;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 65;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-12, 10, -20);
    scene.add(rimLight);

    // 4. Ground Terrain & Multi-Competitor Wide Track Surface (offset on Y by >= 0.02 so no Z-fighting)
    const outerTerrainGeo = new THREE.PlaneGeometry(260, 420);
    outerTerrainGeo.rotateX(-Math.PI / 2);
    const outerTerrainMat = new THREE.MeshStandardMaterial({
      color: 0x0b1324,
      roughness: 0.92,
      metalness: 0.05,
    });
    const outerTerrain = new THREE.Mesh(outerTerrainGeo, outerTerrainMat);
    outerTerrain.position.set(0, -0.03, -120);
    scene.add(outerTerrain);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const asphaltTex = createTrackTexture(maxAniso, false);
    const tartanTex = createTrackTexture(maxAniso, true);

    const trackGeo = new THREE.PlaneGeometry(13.2, 360);
    trackGeo.rotateX(-Math.PI / 2);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltTex,
      roughness: 0.68,
      metalness: 0.12,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, 0, -140);
    trackMesh.receiveShadow = !isSoftwareGl;
    scene.add(trackMesh);

    // 5. Instanced Roadside Stadium Pillars & Light Towers (> 20 instances)
    const pillarCount = 48;
    const pillarGeo = new THREE.BoxGeometry(0.85, 6.5, 0.85);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.35,
    });
    const pillarInstanced = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
    pillarInstanced.frustumCulled = false;

    const beaconGeo = new THREE.BoxGeometry(0.95, 0.45, 0.95);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beaconInstanced = new THREE.InstancedMesh(beaconGeo, beaconMat, pillarCount);
    beaconInstanced.frustumCulled = false;

    const pillarBaseZ: number[] = [];
    for (let i = 0; i < pillarCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const zPos = 15 - row * 12;
      pillarBaseZ.push(zPos);

      _dummyObj.position.set(side * 7.8, 3.25, zPos);
      _dummyObj.scale.set(1, 0.85 + ((i * 7) % 5) * 0.08, 1);
      _dummyObj.updateMatrix();
      pillarInstanced.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(side * 7.8, 6.3, zPos);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      beaconInstanced.setMatrixAt(i, _dummyObj.matrix);
      _instanceColor.setHex(i % 4 === 0 ? 0xf59e0b : 0x06b6d4);
      beaconInstanced.setColorAt(i, _instanceColor);
    }
    pillarInstanced.instanceMatrix.needsUpdate = true;
    beaconInstanced.instanceMatrix.needsUpdate = true;
    if (beaconInstanced.instanceColor) beaconInstanced.instanceColor.needsUpdate = true;
    scene.add(pillarInstanced, beaconInstanced);

    // 6. Actors: Player + Up to 7 Multi-Competitor Rivals (Supports up to 8-Car Grand Prix Grid)
    const playerCar = buildRaceCarGroup(0x06b6d4, 0xf59e0b);
    scene.add(playerCar.root);

    const playerSprinter = buildSprinterGroup(0x06b6d4, 0xf59e0b);
    scene.add(playerSprinter.root);

    const rivalCars = RIVAL_LIVERY_PALETTE.map((pal) => {
      const c = buildRaceCarGroup(pal.primary, pal.accent);
      scene.add(c.root);
      return c;
    });

    const rivalSprinters = RIVAL_LIVERY_PALETTE.map((pal) => {
      const s = buildSprinterGroup(pal.primary, pal.accent);
      scene.add(s.root);
      return s;
    });

    // 7. Hurdle Obstacles Pool (visible when sport === 'hurdles')
    const hurdleGroupContainer = new THREE.Group();
    const hurdlesList: { group: THREE.Group; offsetZ: number; laneX: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const laneX = i % 2 === 0 ? -2.4 : 2.4;
      const offsetZ = -18 - Math.floor(i / 2) * 24;
      const hGroup = buildHurdleGroup();
      hGroup.position.set(laneX, 0, offsetZ);
      hurdleGroupContainer.add(hGroup);
      hurdlesList.push({ group: hGroup, offsetZ, laneX });
    }
    scene.add(hurdleGroupContainer);

    // 8. Overhead Stadium Gantry Arches & Distant Horizon Vista Silhouette
    const gantryGroup = new THREE.Group();
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3,
    });
    const gantryBannerMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    const gantryZOffsets = [-28, -88, -148];
    const gantryMeshes: THREE.Group[] = [];
    gantryZOffsets.forEach((gz) => {
      const arch = new THREE.Group();
      const leftCol = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.2, 0.55), gantryMat);
      leftCol.position.set(-7.1, 3.6, 0);
      const rightCol = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.2, 0.55), gantryMat);
      rightCol.position.set(7.1, 3.6, 0);
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.75, 0.65), gantryMat);
      crossBeam.position.set(0, 7.0, 0);
      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.24, 0.72), gantryBannerMat);
      ledStrip.position.set(0, 6.95, 0);
      arch.add(leftCol, rightCol, crossBeam, ledStrip);
      arch.position.set(0, 0, gz);
      gantryGroup.add(arch);
      gantryMeshes.push(arch);
    });
    scene.add(gantryGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const laneToX = (lane: -1 | 0 | 1) => lane * 2.4;
    let playerCurrentX = -2.4;
    let worldScrollZ = 0;
    let cameraShakeTrauma = 0;
    let prevStumbleTimer = 0;

    let lastFrameTime = performance.now();
    const startTime = lastFrameTime;
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const elapsed = (now - startTime) / 1000;

      const match = matchRef.current;
      const {
        previewSport: currentPreviewSport,
        previewCompetitorCount: currentPreviewCount,
        isTitleScreen: onTitle,
      } = propsRef.current;
      const activeSport = onTitle ? currentPreviewSport : match.sport;
      const isCarMode = activeSport === 'racing';
      const isHurdleMode = activeSport === 'hurdles';

      // Number of rival actors active on track (1 to 7)
      const activeRivalCount = onTitle
        ? Math.max(1, (currentPreviewCount ?? 4) - 1)
        : Math.max(1, match.competitors?.length || 1);

      // Switch track texture cleanly when sport changes
      const desiredTex = isCarMode ? asphaltTex : tartanTex;
      if (trackMat.map !== desiredTex) {
        trackMat.map = desiredTex;
        trackMat.needsUpdate = true;
      }

      playerCar.root.visible = isCarMode;
      playerSprinter.root.visible = !isCarMode;
      hurdleGroupContainer.visible = isHurdleMode;

      // Speed in visual meters/sec
      const playerSpeedKmh = onTitle ? 145 : match.player.speedKmh;
      const visualSpeed = (playerSpeedKmh / 3.6) * 0.55;
      worldScrollZ += visualSpeed * dt;

      // Scroll track texture UV
      desiredTex.offset.y = -(worldScrollZ * 0.08) % 1;

      // Scroll overhead stadium gantry arches
      gantryMeshes.forEach((arch, idx) => {
        let gz = (gantryZOffsets[idx] + worldScrollZ) % 180;
        if (gz > 12) gz -= 180;
        arch.position.z = gz;
      });

      // Scroll roadside stadium pillars seamlessly
      for (let i = 0; i < pillarCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        let zPos = (pillarBaseZ[i] + worldScrollZ) % 288;
        if (zPos > 18) zPos -= 288;

        _dummyObj.position.set(side * 7.8, 3.25, zPos);
        _dummyObj.scale.set(1, 0.85 + ((i * 7) % 5) * 0.08, 1);
        _dummyObj.updateMatrix();
        pillarInstanced.setMatrixAt(i, _dummyObj.matrix);

        _dummyObj.position.set(side * 7.8, 6.3, zPos);
        _dummyObj.scale.set(1, 1, 1);
        _dummyObj.updateMatrix();
        beaconInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      pillarInstanced.instanceMatrix.needsUpdate = true;
      beaconInstanced.instanceMatrix.needsUpdate = true;

      // Smooth exponential lane damping
      const targetPlayerX = onTitle ? -2.4 : laneToX(match.player.laneIndex);
      const dampFactor = 1 - Math.exp(-10 * dt);
      playerCurrentX = THREE.MathUtils.lerp(playerCurrentX, targetPlayerX, dampFactor);

      // Anchor player at z = -4.2 so the hero 3D model sits cleanly in the upper-center viewport above the bottom Quiz Deck
      const playerBaseZ = onTitle ? 0 : -4.2;

      // Trigger trauma shake when stumble begins
      if (!onTitle && match.player.stumbleTimer > prevStumbleTimer) {
        cameraShakeTrauma = 0.65;
      }
      prevStumbleTimer = onTitle ? 0 : match.player.stumbleTimer;
      cameraShakeTrauma = Math.max(0, cameraShakeTrauma - dt * 1.4);

      const isStumbling = !onTitle && match.player.stumbleTimer > 0;
      const isBoosting = !onTitle && match.player.boostTimer > 0;

      // Update Hurdles scroll & calculate dynamic hurdle jump height
      let playerJumpY = 0;
      if (isHurdleMode) {
        for (const h of hurdlesList) {
          let hz = (h.offsetZ + worldScrollZ) % 144;
          if (hz > 14) hz -= 144;
          h.group.position.z = hz;

          // Parabolic jump arc when runner approaches hurdle within +/- 2.6m of playerBaseZ
          if (Math.abs(h.laneX - playerCurrentX) < 1.2 && Math.abs(hz - playerBaseZ) < 2.6 && !isStumbling) {
            const norm = 1 - Math.abs(hz - playerBaseZ) / 2.6;
            playerJumpY = Math.max(playerJumpY, Math.sin(norm * Math.PI) * 1.25);
          }
        }
      }

      if (isCarMode) {
        playerCar.root.position.set(playerCurrentX, 0, playerBaseZ);
        playerCar.root.rotation.y =
          (playerCurrentX - targetPlayerX) * 0.14 + (isStumbling ? Math.sin(elapsed * 28) * 0.18 : 0);
        playerCar.wheels.forEach((w) => {
          w.rotation.x -= visualSpeed * dt * 1.8;
        });
        (playerCar.boostFlame.material as THREE.MeshBasicMaterial).opacity = isBoosting ? 0.85 : 0.15;
        playerCar.boostFlame.scale.setScalar(
          isBoosting ? 1.35 + Math.sin(elapsed * 40) * 0.2 : 0.6
        );
        playerCar.bodyMat.emissive.setHex(
          isStumbling ? 0xef4444 : isBoosting ? 0x06b6d4 : 0x000000
        );
        playerCar.bodyMat.emissiveIntensity = isStumbling || isBoosting ? 0.45 : 0;
      } else {
        // Articulated Sprinter Gait synced to distance traveled
        const stridePhase = worldScrollZ * 1.35;
        const swingAmp = isStumbling ? 0.25 : 0.85;

        playerSprinter.root.position.set(playerCurrentX, playerJumpY, playerBaseZ);
        const stretchY = playerJumpY > 0.2 ? 1.12 : isStumbling ? 0.86 : 1.0;
        playerSprinter.root.scale.set(1 / Math.sqrt(stretchY), stretchY, 1);

        playerSprinter.leftLeg.rotation.x = Math.sin(stridePhase) * swingAmp;
        playerSprinter.rightLeg.rotation.x = -Math.sin(stridePhase) * swingAmp;
        playerSprinter.leftArm.rotation.x = -Math.sin(stridePhase) * swingAmp * 0.8;
        playerSprinter.rightArm.rotation.x = Math.sin(stridePhase) * swingAmp * 0.8;
        playerSprinter.torso.rotation.x = isStumbling ? 0.45 : -0.18;
        playerSprinter.jerseyMat.emissive.setHex(
          isStumbling ? 0xef4444 : isBoosting ? 0x06b6d4 : 0x000000
        );
        playerSprinter.jerseyMat.emissiveIntensity = isStumbling || isBoosting ? 0.5 : 0;
        (playerSprinter.auraRing.material as THREE.MeshBasicMaterial).opacity = isBoosting
          ? 0.75
          : 0;
      }

      // Update Multi-Competitor Rival Pack (up to 7 rival cars/sprinters)
      for (let i = 0; i < rivalCars.length; i++) {
        const isActiveRival = i < activeRivalCount;
        const rCar = rivalCars[i];
        const rSprint = rivalSprinters[i];
        rCar.root.visible = isCarMode && isActiveRival;
        rSprint.root.visible = !isCarMode && isActiveRival;
        if (!isActiveRival) continue;

        const compState = match.competitors?.[i] || match.opponent;
        const slotX = compState?.trackSlotOffset ?? RIVAL_SLOT_OFFSETS[i % RIVAL_SLOT_OFFSETS.length];
        const rowStaggerZ = i >= 3 ? -3.8 * Math.ceil((i - 2) / 2) : 0;
        const distanceLead = onTitle
          ? Math.sin(elapsed * 0.85 + i * 1.1) * 3.5
          : THREE.MathUtils.clamp(
              ((compState?.distanceMeters ?? 0) - match.player.distanceMeters) * 0.22,
              -2.5,
              18
            );
        const rivalZ = playerBaseZ - distanceLead + rowStaggerZ;

        if (isCarMode) {
          rCar.root.position.set(slotX, 0, rivalZ);
          rCar.wheels.forEach((w) => {
            w.rotation.x -= visualSpeed * dt * 1.75;
          });
        } else {
          let rJumpY = 0;
          if (isHurdleMode) {
            for (const h of hurdlesList) {
              if (Math.abs(h.laneX - slotX) < 1.5 && Math.abs(h.group.position.z - rivalZ) < 2.6) {
                const norm = 1 - Math.abs(h.group.position.z - rivalZ) / 2.6;
                rJumpY = Math.max(rJumpY, Math.sin(norm * Math.PI) * 1.25);
              }
            }
          }
          const rivalPhase = worldScrollZ * 1.3 + i * 0.9 + 1.2;
          rSprint.root.position.set(slotX, rJumpY, rivalZ);
          rSprint.leftLeg.rotation.x = Math.sin(rivalPhase) * 0.8;
          rSprint.rightLeg.rotation.x = -Math.sin(rivalPhase) * 0.8;
          rSprint.leftArm.rotation.x = -Math.sin(rivalPhase) * 0.7;
          rSprint.rightArm.rotation.x = Math.sin(rivalPhase) * 0.7;
        }
      }

      // 9. Camera Choreography: Spline Tour on Title Screen -> Elevated Chase Cam framing Actors in Upper-Middle Viewport
      if (onTitle) {
        const orbitAngle = elapsed * 0.28;
        _camTargetPos.set(
          Math.sin(orbitAngle) * 6.5,
          3.8 + Math.sin(elapsed * 0.5) * 0.6,
          6.8 + Math.cos(orbitAngle) * 2.5
        );
        _camLookAtPos.set(0, 1.1, -6);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 58, dampFactor);
      } else {
        const shakeOffset = cameraShakeTrauma * cameraShakeTrauma * 0.45;
        _camTargetPos.set(
          playerCurrentX * 0.42 + Math.sin(elapsed * 45) * shakeOffset,
          2.65 + (isBoosting ? 0.2 : 0) + Math.cos(elapsed * 38) * shakeOffset,
          3.1
        );
        _camLookAtPos.set(playerCurrentX * 0.3, -1.1, -10);
        const targetFov = THREE.MathUtils.clamp(58 + (playerSpeedKmh - 100) * 0.08, 56, 74);
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dampFactor);
      }
      camera.updateProjectionMatrix();
      camera.position.lerp(_camTargetPos, dampFactor);
      _currentLookAt.lerp(_camLookAtPos, dampFactor);
      camera.lookAt(_currentLookAt);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      asphaltTex.dispose();
      tartanTex.dispose();
      renderer.dispose();
    };
  }, [matchRef]);

  return (
    <div
      ref={mountRef}
      data-testid="three-race-viewport"
      className="w-full h-full relative overflow-hidden bg-[#070B16]"
      aria-label="3D Tournament Track Viewport"
    />
  );
};
