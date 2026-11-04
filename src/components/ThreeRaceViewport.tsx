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
  { primary: 0xe11d48, accent: 0x38bdf8 },
  { primary: 0x7c3aed, accent: 0xf59e0b },
  { primary: 0x059669, accent: 0x22d3ee },
  { primary: 0xea580c, accent: 0x38bdf8 },
  { primary: 0x2563eb, accent: 0xfacc15 },
  { primary: 0xdb2777, accent: 0x2dd4bf },
  { primary: 0xca8a04, accent: 0xf43f5e },
];

const RIVAL_SLOT_OFFSETS = [2.4, 0, -4.4, 4.4, -1.2, 1.2, 3.6];

/**
 * Generates a tileable grayscale micro-relief bump/roughness texture for asphalt, tartan, and rubber.
 */
function createMicroReliefBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    const x = (i * 73 + (i % 17) * 13) % 256;
    const y = (i * 139 + (i % 29) * 7) % 256;
    const shade = i % 2 === 0 ? 155 : 100;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 72);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a diagonal carbon-fiber weave bump map for aerodynamic wings, splitters, and chassis trim.
 */
function createCarbonWeaveTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 64, 64);

  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const offset = (y / 8) % 2 === 0 ? 0 : 4;
      ctx.fillStyle = '#334155';
      ctx.fillRect((x + offset) % 64, y, 4, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect((x + offset + 4) % 64, y + 4, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTrackTexture(maxAnisotropy: number, isTrackField: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (isTrackField) {
    // World Athletics crimson/terracotta synthetic Mondo track surface
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#6b2114');
    grad.addColorStop(0.5, '#852d1c');
    grad.addColorStop(1, '#6b2114');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Elastomer rubber granule texture
    for (let i = 0; i < 1600; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, 2, 3);
    }

    // Outside concrete drain apron
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 12, 512);
    ctx.fillRect(500, 0, 12, 512);

    // Crisp white regulation lane lines & stagger boxes
    ctx.fillStyle = '#f8fafc';
    const laneXs = [14, 96, 176, 256, 336, 416, 494];
    for (const lx of laneXs) {
      ctx.fillRect(lx, 0, 4, 512);
    }
    ctx.fillStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.fillRect(14, 248, 484, 6);
  } else {
    // Grand Prix dark polymer-modified asphalt with rubbered-in racing line
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#141c2b');
    grad.addColorStop(0.25, '#0f1623');
    grad.addColorStop(0.5, '#172033');
    grad.addColorStop(0.75, '#0f1623');
    grad.addColorStop(1, '#141c2b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt aggregate micro-grain
    for (let i = 0; i < 1600; i++) {
      const x = (i * 97) % 512;
      const y = (i * 193) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, y, 2, 4);
    }

    // FIA Red & White serrated apex curbs + green astroturf verge
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, 28, 512);
    ctx.fillRect(484, 0, 28, 512);

    for (let y = 0; y < 512; y += 32) {
      ctx.fillStyle = (y / 32) % 2 === 0 ? '#dc2626' : '#f8fafc';
      ctx.fillRect(6, y, 20, 30);
      ctx.fillRect(486, y, 20, 30);
    }

    // Continuous white track-limit lines
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(28, 0, 4, 512);
    ctx.fillRect(480, 0, 4, 512);

    // Dashed multi-competitor grid lane dividers
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(140, y, 4, 34);
      ctx.fillRect(254, y, 4, 34);
      ctx.fillRect(368, y, 4, 34);
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
 * Composite 12-part Realistic Formula Prototype Race Car (THREE.Group)
 * Uses MeshPhysicalMaterial automotive clearcoat, carbon-fiber weave, Halo cockpit,
 * driver helmet, double-wishbone suspension, and multi-read alloy wheels.
 * Pivot is at bottom-center (y = 0) so tires sit flush on the asphalt surface.
 */
function buildRaceCarGroup(
  primaryHex: number,
  accentHex: number,
  carbonTex: THREE.CanvasTexture
): {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  boostFlame: THREE.Group;
  bodyMat: THREE.MeshPhysicalMaterial;
} {
  const root = new THREE.Group();

  // Automotive metallic clearcoat paint
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: primaryHex,
    metalness: 0.78,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.35,
  });

  // Carbon-fiber aerodynamic composite
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.38,
    bumpMap: carbonTex,
    bumpScale: 0.015,
  });

  // Anodized metallic accent trim
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentHex,
    metalness: 0.65,
    roughness: 0.25,
    clearcoat: 0.8,
    emissive: accentHex,
    emissiveIntensity: 0.18,
  });

  // Tinted polycarbonate canopy / visor
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  // Pirelli-style slick racing rubber
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.12,
    roughness: 0.86,
  });

  // Forged magnesium alloy rim
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.92,
    roughness: 0.18,
  });

  // 1. Primary Underbody Carbon Floor & Diffuser Plank
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.88, -1.55);
  floorShape.lineTo(0.88, -1.55);
  floorShape.lineTo(0.95, 0.85);
  floorShape.lineTo(0.72, 1.35);
  floorShape.lineTo(-0.72, 1.35);
  floorShape.lineTo(-0.95, 0.85);
  floorShape.closePath();

  const floorGeo = new THREE.ExtrudeGeometry(floorShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  floorGeo.rotateX(Math.PI / 2);
  floorGeo.translate(0, 0.14, 0);
  const floorMesh = new THREE.Mesh(floorGeo, carbonMat);
  floorMesh.castShadow = true;
  root.add(floorMesh);

  // 2. Sculpted Central Monocoque & Engine Cover Spine
  const monocoqueShape = new THREE.Shape();
  monocoqueShape.moveTo(-0.42, -1.25);
  monocoqueShape.lineTo(0.42, -1.25);
  monocoqueShape.lineTo(0.52, -0.1);
  monocoqueShape.lineTo(0.34, 1.18);
  monocoqueShape.lineTo(-0.34, 1.18);
  monocoqueShape.lineTo(-0.52, -0.1);
  monocoqueShape.closePath();

  const monocoqueGeo = new THREE.ExtrudeGeometry(monocoqueShape, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.08,
    bevelSegments: 3,
  });
  monocoqueGeo.rotateX(Math.PI / 2);
  monocoqueGeo.translate(0, 0.58, 0);
  const monocoqueMesh = new THREE.Mesh(monocoqueGeo, bodyMat);
  monocoqueMesh.castShadow = true;
  root.add(monocoqueMesh);

  // 3. Left & Right Aerodynamic Sidepods with Radiator Intakes
  [-1, 1].forEach((side) => {
    const podGeo = new THREE.BoxGeometry(0.44, 0.36, 1.45);
    const podMesh = new THREE.Mesh(podGeo, bodyMat);
    podMesh.position.set(side * 0.62, 0.36, -0.05);
    podMesh.rotation.y = side * -0.06;
    podMesh.castShadow = true;
    root.add(podMesh);

    // Recessed dark radiator intake duct
    const intakeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.08), carbonMat);
    intakeMesh.position.set(side * 0.62, 0.37, -0.78);
    root.add(intakeMesh);

    // Sidepod livery accent blade
    const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 1.25), accentMat);
    stripeMesh.position.set(side * 0.63, 0.42, -0.04);
    stripeMesh.rotation.y = side * -0.06;
    root.add(stripeMesh);
  });

  // 4. Tapered Downward-Sloping Front Nosecone
  const noseGeo = new THREE.CylinderGeometry(0.16, 0.36, 1.35, 16);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.scale(1.15, 0.62, 1.0);
  const noseMesh = new THREE.Mesh(noseGeo, bodyMat);
  noseMesh.position.set(0, 0.33, -1.68);
  noseMesh.rotation.x = 0.08;
  noseMesh.castShadow = true;
  root.add(noseMesh);

  // 5. Overhead Roll-Hoop Airbox & Dorsal Shark Fin
  const airboxGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.55, 14);
  airboxGeo.rotateX(Math.PI / 2);
  const airboxMesh = new THREE.Mesh(airboxGeo, bodyMat);
  airboxMesh.position.set(0, 0.82, 0.32);
  root.add(airboxMesh);

  const sharkFinGeo = new THREE.BoxGeometry(0.05, 0.34, 0.82);
  const sharkFin = new THREE.Mesh(sharkFinGeo, carbonMat);
  sharkFin.position.set(0, 0.84, 0.72);
  root.add(sharkFin);

  // 6. Cockpit Recess, Driver Helmet + Visor & Titanium FIA Halo Safety Bar
  const cockpitRecess = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.72), carbonMat);
  cockpitRecess.position.set(0, 0.62, -0.22);
  root.add(cockpitRecess);

  const helmetGeo = new THREE.SphereGeometry(0.19, 16, 14);
  const helmetMesh = new THREE.Mesh(helmetGeo, accentMat);
  helmetMesh.position.set(0, 0.74, -0.18);
  root.add(helmetMesh);

  const helmetVisor = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 10), canopyMat);
  helmetVisor.scale.set(0.95, 0.52, 0.95);
  helmetVisor.position.set(0, 0.75, -0.22);
  root.add(helmetVisor);

  // Curved Titanium Halo Safety Hoop + Center Pillar
  const haloGeo = new THREE.TorusGeometry(0.36, 0.032, 10, 24, Math.PI);
  haloGeo.rotateX(Math.PI / 2);
  haloGeo.rotateZ(Math.PI);
  const haloMesh = new THREE.Mesh(haloGeo, carbonMat);
  haloMesh.position.set(0, 0.82, -0.12);
  haloMesh.rotation.x = 0.14;
  root.add(haloMesh);

  const haloPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.24, 8), carbonMat);
  haloPillar.position.set(0, 0.73, -0.46);
  haloPillar.rotation.x = -0.35;
  root.add(haloPillar);

  // 7. Multi-Element Front Wing Assembly + Endplates
  const frontMainPlane = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.05, 0.34), carbonMat);
  frontMainPlane.position.set(0, 0.15, -2.22);
  const frontFlapPlane = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.04, 0.22), accentMat);
  frontFlapPlane.position.set(0, 0.2, -2.12);
  frontFlapPlane.rotation.x = -0.16;
  root.add(frontMainPlane, frontFlapPlane);

  [-0.96, 0.96].forEach((x) => {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.48), bodyMat);
    endplate.position.set(x, 0.22, -2.18);
    root.add(endplate);
  });

  // 8. Swan-Neck Rear DRS Wing + Twin Endplates + Rear Diffuser + FIA Rain Light
  const rearMainPlane = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.36), carbonMat);
  rearMainPlane.position.set(0, 0.98, 1.18);
  const rearDrsFlap = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.05, 0.22), accentMat);
  rearDrsFlap.position.set(0, 1.08, 1.26);
  rearDrsFlap.rotation.x = -0.22;
  root.add(rearMainPlane, rearDrsFlap);

  [-0.84, 0.84].forEach((x) => {
    const rearEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.52), bodyMat);
    rearEndplate.position.set(x, 0.88, 1.2);
    root.add(rearEndplate);
  });

  [-0.18, 0.18].forEach((x) => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.22), carbonMat);
    pylon.position.set(x, 0.76, 1.12);
    pylon.rotation.x = 0.15;
    root.add(pylon);
  });

  // FIA Rear LED Rain & ERS Telemetry Light
  const rainLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.06), rainLightMat);
  rainLight.position.set(0, 0.34, 1.38);
  root.add(rainLight);

  // 9. Double-Wishbone Suspension Struts (Front & Rear)
  const wishboneGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.58, 8);
  wishboneGeo.rotateZ(Math.PI / 2);
  [-1, 1].forEach((side) => {
    const frontUpper = new THREE.Mesh(wishboneGeo, carbonMat);
    frontUpper.position.set(side * 0.56, 0.38, -1.42);
    const frontLower = new THREE.Mesh(wishboneGeo, carbonMat);
    frontLower.position.set(side * 0.56, 0.24, -1.42);
    const rearUpper = new THREE.Mesh(wishboneGeo, carbonMat);
    rearUpper.position.set(side * 0.58, 0.4, 0.85);
    root.add(frontUpper, frontLower, rearUpper);
  });

  // 10. Four Multi-Part Pirelli-Style Racing Wheels (Tire + Alloy Rim + Sidewall Ring + Spokes + Center Lock)
  const wheelConfigs: { pos: [number, number, number]; width: number; radius: number }[] = [
    { pos: [-0.94, 0.36, -1.42], width: 0.34, radius: 0.36 },
    { pos: [0.94, 0.36, -1.42], width: 0.34, radius: 0.36 },
    { pos: [-0.98, 0.38, 0.85], width: 0.42, radius: 0.38 },
    { pos: [0.98, 0.38, 0.85], width: 0.42, radius: 0.38 },
  ];

  const wheels: THREE.Object3D[] = [];
  wheelConfigs.forEach(({ pos, width, radius }) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos[0], pos[1], pos[2]);
    const isRight = pos[0] > 0;
    const outDir = isRight ? 1 : -1;

    // Slick rubber tire barrel
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Forged alloy rim dish
    const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.015, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, alloyMat);
    wheelGroup.add(rimMesh);

    // Cross spokes for visible wheel rotation
    const spokeA = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.025, radius * 1.12, 0.055),
      carbonMat
    );
    const spokeB = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.025, 0.055, radius * 1.12),
      carbonMat
    );
    wheelGroup.add(spokeA, spokeB);

    // Colored Pirelli sidewall compound ring
    const ringGeo = new THREE.RingGeometry(radius * 0.68, radius * 0.82, 24);
    ringGeo.rotateY(outDir * (Math.PI / 2));
    const sidewallRing = new THREE.Mesh(ringGeo, accentMat);
    sidewallRing.position.set(outDir * (width / 2 + 0.008), 0, 0);
    wheelGroup.add(sidewallRing);

    // Center-lock wheel nut
    const nutGeo = new THREE.CylinderGeometry(0.06, 0.06, width + 0.04, 10);
    nutGeo.rotateZ(Math.PI / 2);
    const nutMesh = new THREE.Mesh(nutGeo, accentMat);
    wheelGroup.add(nutMesh);

    root.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // 11. Twin Titanium Exhaust Nozzles & Dual Afterburner Plume Group
  const exhaustNozzleGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.28, 12);
  exhaustNozzleGeo.rotateX(Math.PI / 2);
  const exhaustNozzle = new THREE.Mesh(exhaustNozzleGeo, alloyMat);
  exhaustNozzle.position.set(0, 0.48, 1.32);
  root.add(exhaustNozzle);

  const boostFlame = new THREE.Group();
  boostFlame.position.set(0, 0.48, 1.72);
  const outerFlameGeo = new THREE.ConeGeometry(0.22, 1.15, 14);
  outerFlameGeo.rotateX(Math.PI / 2);
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.25,
  });
  const innerFlameGeo = new THREE.ConeGeometry(0.11, 0.75, 12);
  innerFlameGeo.rotateX(Math.PI / 2);
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.4,
  });
  boostFlame.add(
    new THREE.Mesh(outerFlameGeo, outerFlameMat),
    new THREE.Mesh(innerFlameGeo, innerFlameMat)
  );
  root.add(boostFlame);

  // 12. Soft Ground Contact Shadow Disc (y = 0.015)
  const shadowGeo = new THREE.CircleGeometry(1.5, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.015, -0.2);
  shadowDisc.scale.set(0.92, 1, 1.72);
  root.add(shadowDisc);
  root.scale.setScalar(0.84);

  return { root, wheels, boostFlame, bodyMat };
}

/**
 * Composite 12-part Articulated Olympic Sprinter Athlete (THREE.Group)
 * Features multi-jointed shoulder+elbow arms, hip+knee+ankle legs, track spikes,
 * athletic singlet with chest bib, sculpted head/hair, and polarized wrap-around visor.
 */
function buildSprinterGroup(jerseyHex: number, accentHex: number): {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  torso: THREE.Group;
  jerseyMat: THREE.MeshPhysicalMaterial;
  auraRing: THREE.Mesh;
} {
  const root = new THREE.Group();

  const jerseyMat = new THREE.MeshPhysicalMaterial({
    color: jerseyHex,
    metalness: 0.12,
    roughness: 0.58,
    sheen: 0.65,
    sheenRoughness: 0.45,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b72,
    metalness: 0.06,
    roughness: 0.68,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.15,
    roughness: 0.78,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: accentHex,
    metalness: 0.88,
    roughness: 0.1,
    clearcoat: 1.0,
    emissive: accentHex,
    emissiveIntensity: 0.25,
  });
  const bibMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
    metalness: 0.05,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
  });

  // 1. Articulated Upper Torso Group (Singlet + Pelvis + Chest Bib + Trim Stripes)
  const torso = new THREE.Group();
  torso.position.set(0, 1.38, 0);

  const chestGeo = new THREE.CapsuleGeometry(0.29, 0.52, 10, 16);
  chestGeo.scale(1.14, 1.0, 0.78);
  const chestMesh = new THREE.Mesh(chestGeo, jerseyMat);
  chestMesh.position.set(0, 0.14, 0);
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  const pelvisGeo = new THREE.CapsuleGeometry(0.26, 0.22, 8, 14);
  pelvisGeo.scale(1.08, 1.0, 0.82);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, shortsMat);
  pelvisMesh.position.set(0, -0.26, 0);
  torso.add(pelvisMesh);

  // Chest & Back Athlete Number Bibs
  const frontBib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.02), bibMat);
  frontBib.position.set(0, 0.18, -0.23);
  const backBib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.02), bibMat);
  backBib.position.set(0, 0.18, 0.23);
  torso.add(frontBib, backBib);

  // 2. Neck, Head, Sculpted Hair & Wrap-Around Aerodynamic Visor attached to Torso
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 12), skinMat);
  neckMesh.position.set(0, 0.56, -0.02);
  torso.add(neckMesh);

  const headGeo = new THREE.SphereGeometry(0.23, 18, 14);
  headGeo.scale(0.92, 1.06, 0.98);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 0.76, -0.04);
  headMesh.castShadow = true;
  torso.add(headMesh);

  const hairGeo = new THREE.SphereGeometry(0.238, 16, 12);
  hairGeo.scale(0.94, 0.92, 1.02);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.position.set(0, 0.81, 0.01);
  torso.add(hairMesh);

  const visorGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.1, 16, 1, false, -Math.PI * 0.65, Math.PI * 1.3);
  visorGeo.rotateY(Math.PI);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.77, -0.05);
  torso.add(visorMesh);

  root.add(torso);

  // 3 & 4. Two-Segment Articulated Left & Right Arms (Shoulder -> Upper Arm -> Elbow -> Forearm + Wristband + Hand)
  const makeArticulatedArm = (side: -1 | 1) => {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(side * 0.4, 1.78, 0);

    const upperArmGeo = new THREE.CapsuleGeometry(0.095, 0.32, 8, 12);
    const upperArm = new THREE.Mesh(upperArmGeo, skinMat);
    upperArm.position.set(0, -0.18, 0);
    upperArm.castShadow = true;
    shoulderGroup.add(upperArm);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(0, -0.38, 0);

    const forearmGeo = new THREE.CapsuleGeometry(0.08, 0.3, 8, 12);
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.set(0, -0.16, 0);
    elbowGroup.add(forearm);

    const wristband = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.08, 12), visorMat);
    wristband.position.set(0, -0.28, 0);
    elbowGroup.add(wristband);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat);
    hand.scale.set(0.8, 1.15, 0.95);
    hand.position.set(0, -0.36, 0);
    elbowGroup.add(hand);

    shoulderGroup.add(elbowGroup);
    root.add(shoulderGroup);
    return { shoulderGroup, elbowGroup };
  };

  const { shoulderGroup: leftArm, elbowGroup: leftElbow } = makeArticulatedArm(-1);
  const { shoulderGroup: rightArm, elbowGroup: rightElbow } = makeArticulatedArm(1);

  // 5 & 6. Two-Segment Articulated Left & Right Legs (Hip -> Thigh -> Knee -> Calf -> Sprint Spike Shoe)
  const makeArticulatedLeg = (side: -1 | 1) => {
    const hipGroup = new THREE.Group();
    hipGroup.position.set(side * 0.19, 1.06, 0);

    const thighGeo = new THREE.CapsuleGeometry(0.135, 0.38, 8, 12);
    const thigh = new THREE.Mesh(thighGeo, shortsMat);
    thigh.position.set(0, -0.22, 0);
    thigh.castShadow = true;
    hipGroup.add(thigh);

    const kneeGroup = new THREE.Group();
    kneeGroup.position.set(0, -0.46, 0);

    const calfGeo = new THREE.CapsuleGeometry(0.1, 0.38, 8, 12);
    const calf = new THREE.Mesh(calfGeo, skinMat);
    calf.position.set(0, -0.22, 0);
    calf.castShadow = true;
    kneeGroup.add(calf);

    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.092, 0.16, 12), bibMat);
    sock.position.set(0, -0.38, 0);
    kneeGroup.add(sock);

    // Multi-part Olympic Track Spike Shoe
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.5, -0.07);
    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.38), visorMat);
    shoeUpper.position.set(0, 0.03, 0);
    const spikeSole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.4), shortsMat);
    spikeSole.position.set(0, -0.04, 0);
    shoeGroup.add(shoeUpper, spikeSole);
    kneeGroup.add(shoeGroup);

    hipGroup.add(kneeGroup);
    root.add(hipGroup);
    return { hipGroup, kneeGroup };
  };

  const { hipGroup: leftLeg, kneeGroup: leftKnee } = makeArticulatedLeg(-1);
  const { hipGroup: rightLeg, kneeGroup: rightKnee } = makeArticulatedLeg(1);

  // 7. Speed Boost Ground Ring
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

  // 8. Soft Ground Contact Shadow Disc
  const shadowGeo = new THREE.CircleGeometry(0.75, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.015, 0);
  root.add(shadowDisc);

  return {
    root,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
    torso,
    jerseyMat,
    auraRing,
  };
}

/**
 * Multi-part Championship Track Hurdle (THREE.Group) with counterweighted L-base,
 * telescopic uprights, striped polycarbonate top bar, and contact shadow.
 */
function buildHurdleGroup(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.82,
    roughness: 0.24,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.4,
  });
  const barMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.12,
    roughness: 0.32,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    metalness: 0.2,
    roughness: 0.38,
  });

  // Left & Right L-base feet + counterweights + telescopic upright tubes + bottom cross-brace
  [-0.95, 0.95].forEach((x) => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.78), metalMat);
    foot.position.set(x, 0.035, 0.28);
    const weight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.24), darkMetalMat);
    weight.position.set(x, 0.05, 0.56);
    const lowerTube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.58, 12), darkMetalMat);
    lowerTube.position.set(x, 0.3, 0);
    const upperTube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.62, 12), metalMat);
    upperTube.position.set(x, 0.78, 0);
    group.add(foot, weight, lowerTube, upperTube);
  });

  const bottomBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 10), metalMat);
  bottomBrace.rotation.z = Math.PI / 2;
  bottomBrace.position.set(0, 0.08, 0);
  group.add(bottomBrace);

  // Top crossbar + high-contrast warning stripes
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.16, 0.07), barMat);
  bar.position.set(0, 1.08, 0);
  bar.castShadow = true;
  [-0.72, -0.24, 0.24, 0.72].forEach((sx, idx) => {
    if (idx % 2 === 0) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.165, 0.078), stripeMat);
      stripe.position.set(sx, 1.08, 0);
      group.add(stripe);
    }
  });
  group.add(bar);

  // Soft ground shadow strip under hurdle
  const hurdleShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.45),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );
  hurdleShadow.rotation.x = -Math.PI / 2;
  hurdleShadow.position.set(0, 0.012, 0.1);
  group.add(hurdleShadow);

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
    scene.fog = new THREE.FogExp2(0x070b16, 0.0082);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 280);
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
    renderer.toneMappingExposure = 1.15;
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

    // 3. Warm Key Light + Cool Hemisphere Fill + Stadium Rim Backlight
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.9);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4db, 1.75);
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

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-14, 12, -22);
    scene.add(rimLight);

    // 4. Ground Terrain & Multi-Competitor Wide Track Surface with Micro-Relief Bump Map
    const outerTerrainGeo = new THREE.PlaneGeometry(260, 420);
    outerTerrainGeo.rotateX(-Math.PI / 2);
    const outerTerrainMat = new THREE.MeshStandardMaterial({
      color: 0x09101f,
      roughness: 0.94,
      metalness: 0.05,
    });
    const outerTerrain = new THREE.Mesh(outerTerrainGeo, outerTerrainMat);
    outerTerrain.position.set(0, -0.03, -120);
    scene.add(outerTerrain);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const asphaltTex = createTrackTexture(maxAniso, false);
    const tartanTex = createTrackTexture(maxAniso, true);
    const microBumpTex = createMicroReliefBumpTexture(maxAniso);
    const carbonTex = createCarbonWeaveTexture(maxAniso);

    const trackGeo = new THREE.PlaneGeometry(13.4, 360);
    trackGeo.rotateX(-Math.PI / 2);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltTex,
      bumpMap: microBumpTex,
      bumpScale: 0.018,
      roughnessMap: microBumpTex,
      roughness: 0.62,
      metalness: 0.14,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, 0, -140);
    trackMesh.receiveShadow = !isSoftwareGl;
    scene.add(trackMesh);

    // 5. Instanced Roadside Stadium Floodlight Towers & Steel Guardrails (> 20 instances)
    const pillarCount = 48;
    const pillarGeo = new THREE.CylinderGeometry(0.28, 0.42, 7.2, 12);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.72,
      roughness: 0.28,
    });
    const pillarInstanced = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
    pillarInstanced.frustumCulled = false;

    const beaconGeo = new THREE.BoxGeometry(1.35, 0.52, 0.65);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const beaconInstanced = new THREE.InstancedMesh(beaconGeo, beaconMat, pillarCount);
    beaconInstanced.frustumCulled = false;

    const barrierGeo = new THREE.BoxGeometry(0.28, 0.75, 11.4);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.78,
      roughness: 0.32,
    });
    const barrierInstanced = new THREE.InstancedMesh(barrierGeo, barrierMat, pillarCount);
    barrierInstanced.frustumCulled = false;

    const pillarBaseZ: number[] = [];
    for (let i = 0; i < pillarCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const zPos = 15 - row * 12;
      pillarBaseZ.push(zPos);

      _dummyObj.position.set(side * 8.2, 3.6, zPos);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 0.9 + ((i * 7) % 5) * 0.06, 1);
      _dummyObj.updateMatrix();
      pillarInstanced.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(side * 7.7, 6.9, zPos);
      _dummyObj.rotation.set(0.25, side * -0.35, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      beaconInstanced.setMatrixAt(i, _dummyObj.matrix);
      _instanceColor.setHex(i % 4 === 0 ? 0xf59e0b : 0x38bdf8);
      beaconInstanced.setColorAt(i, _instanceColor);

      _dummyObj.position.set(side * 6.95, 0.42, zPos);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      barrierInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    pillarInstanced.instanceMatrix.needsUpdate = true;
    beaconInstanced.instanceMatrix.needsUpdate = true;
    barrierInstanced.instanceMatrix.needsUpdate = true;
    if (beaconInstanced.instanceColor) beaconInstanced.instanceColor.needsUpdate = true;
    scene.add(pillarInstanced, beaconInstanced, barrierInstanced);

    // 6. Actors: Player + Up to 7 Multi-Competitor Rivals (Supports up to 8-Car Grand Prix Grid)
    const playerCar = buildRaceCarGroup(0x06b6d4, 0xf59e0b, carbonTex);
    scene.add(playerCar.root);

    const playerSprinter = buildSprinterGroup(0x06b6d4, 0xf59e0b);
    scene.add(playerSprinter.root);

    const rivalCars = RIVAL_LIVERY_PALETTE.map((pal) => {
      const c = buildRaceCarGroup(pal.primary, pal.accent, carbonTex);
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

    // 8. Overhead Stadium Telemetry Gantry Arches & Starting Lights
    const gantryGroup = new THREE.Group();
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.78,
      roughness: 0.25,
    });
    const gantryBannerMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });
    const gantryZOffsets = [-28, -88, -148];
    const gantryMeshes: THREE.Group[] = [];
    gantryZOffsets.forEach((gz) => {
      const arch = new THREE.Group();
      const leftCol = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 7.4, 12), gantryMat);
      leftCol.position.set(-7.2, 3.7, 0);
      const rightCol = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 7.4, 12), gantryMat);
      rightCol.position.set(7.2, 3.7, 0);
      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.85, 0.75), gantryMat);
      crossBeam.position.set(0, 7.1, 0);
      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.26, 0.82), gantryBannerMat);
      ledStrip.position.set(0, 7.05, 0);

      // 5 FIA Starting / Sector Signal Pods suspended under gantry
      [-3.6, -1.8, 0, 1.8, 3.6].forEach((lx) => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.35), gantryMat);
        pod.position.set(lx, 6.45, 0.2);
        arch.add(pod);
      });

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

      // Scroll track texture UV & bump map UV
      const uvOffset = -(worldScrollZ * 0.08) % 1;
      desiredTex.offset.y = uvOffset;
      microBumpTex.offset.y = -(worldScrollZ * 0.16) % 1;

      // Scroll overhead stadium gantry arches
      gantryMeshes.forEach((arch, idx) => {
        let gz = (gantryZOffsets[idx] + worldScrollZ) % 180;
        if (gz > 12) gz -= 180;
        arch.position.z = gz;
      });

      // Scroll roadside stadium floodlight pillars & guardrails seamlessly
      for (let i = 0; i < pillarCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        let zPos = (pillarBaseZ[i] + worldScrollZ) % 288;
        if (zPos > 18) zPos -= 288;

        _dummyObj.position.set(side * 8.2, 3.6, zPos);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, 0.9 + ((i * 7) % 5) * 0.06, 1);
        _dummyObj.updateMatrix();
        pillarInstanced.setMatrixAt(i, _dummyObj.matrix);

        _dummyObj.position.set(side * 7.7, 6.9, zPos);
        _dummyObj.rotation.set(0.25, side * -0.35, 0);
        _dummyObj.scale.set(1, 1, 1);
        _dummyObj.updateMatrix();
        beaconInstanced.setMatrixAt(i, _dummyObj.matrix);

        _dummyObj.position.set(side * 6.95, 0.42, zPos);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, 1, 1);
        _dummyObj.updateMatrix();
        barrierInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      pillarInstanced.instanceMatrix.needsUpdate = true;
      beaconInstanced.instanceMatrix.needsUpdate = true;
      barrierInstanced.instanceMatrix.needsUpdate = true;

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
          if (
            Math.abs(h.laneX - playerCurrentX) < 1.2 &&
            Math.abs(hz - playerBaseZ) < 2.6 &&
            !isStumbling
          ) {
            const norm = 1 - Math.abs(hz - playerBaseZ) / 2.6;
            playerJumpY = Math.max(playerJumpY, Math.sin(norm * Math.PI) * 1.25);
          }
        }
      }

      if (isCarMode) {
        const steerDelta = playerCurrentX - targetPlayerX;
        playerCar.root.position.set(playerCurrentX, 0, playerBaseZ);
        playerCar.root.rotation.y =
          steerDelta * 0.14 + (isStumbling ? Math.sin(elapsed * 28) * 0.18 : 0);
        // Subtle chassis roll on lane change & pitch under boost
        playerCar.root.rotation.z = THREE.MathUtils.clamp(-steerDelta * 0.08, -0.12, 0.12);
        playerCar.root.rotation.x = isBoosting ? -0.025 : isStumbling ? 0.035 : 0;

        playerCar.wheels.forEach((w, wIdx) => {
          w.rotation.x -= visualSpeed * dt * 1.85;
          if (wIdx < 2) {
            w.rotation.y = THREE.MathUtils.clamp(-steerDelta * 0.22, -0.32, 0.32);
          }
        });
        playerCar.boostFlame.visible = true;
        playerCar.boostFlame.scale.setScalar(
          isBoosting ? 1.35 + Math.sin(elapsed * 42) * 0.22 : 0.55 + Math.sin(elapsed * 25) * 0.06
        );
        playerCar.bodyMat.emissive.setHex(
          isStumbling ? 0xef4444 : isBoosting ? 0x06b6d4 : 0x000000
        );
        playerCar.bodyMat.emissiveIntensity = isStumbling || isBoosting ? 0.38 : 0;
      } else {
        // Articulated Sprinter Multi-Joint Gait synced to distance traveled
        const stridePhase = worldScrollZ * 1.35;
        const swingAmp = isStumbling ? 0.28 : 0.88;
        const bobY = Math.abs(Math.cos(stridePhase)) * 0.09;

        playerSprinter.root.position.set(playerCurrentX, playerJumpY + bobY, playerBaseZ);
        const stretchY = playerJumpY > 0.2 ? 1.1 : isStumbling ? 0.88 : 1.0;
        playerSprinter.root.scale.set(1 / Math.sqrt(stretchY), stretchY, 1);

        const leftSin = Math.sin(stridePhase);
        const rightSin = -leftSin;

        playerSprinter.leftLeg.rotation.x = leftSin * swingAmp;
        playerSprinter.rightLeg.rotation.x = rightSin * swingAmp;
        // Realistic knee flexion (knees bend backward +X when leg swings back or lifts)
        playerSprinter.leftKnee.rotation.x = Math.max(0.12, -leftSin * 0.75 + 0.45);
        playerSprinter.rightKnee.rotation.x = Math.max(0.12, -rightSin * 0.75 + 0.45);

        playerSprinter.leftArm.rotation.x = rightSin * swingAmp * 0.82;
        playerSprinter.rightArm.rotation.x = leftSin * swingAmp * 0.82;
        // Realistic 90-degree sprinter elbow drive (-X forward bend)
        playerSprinter.leftElbow.rotation.x = -1.15 - Math.max(0, rightSin) * 0.35;
        playerSprinter.rightElbow.rotation.x = -1.15 - Math.max(0, leftSin) * 0.35;

        playerSprinter.torso.rotation.x = isStumbling ? 0.42 : -0.22;
        playerSprinter.torso.rotation.y = leftSin * 0.12;
        playerSprinter.jerseyMat.emissive.setHex(
          isStumbling ? 0xef4444 : isBoosting ? 0x06b6d4 : 0x000000
        );
        playerSprinter.jerseyMat.emissiveIntensity = isStumbling || isBoosting ? 0.45 : 0;
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
        const slotX =
          compState?.trackSlotOffset ?? RIVAL_SLOT_OFFSETS[i % RIVAL_SLOT_OFFSETS.length];
        const rowStaggerZ = -(i + 1) * 1.45;
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
              if (
                Math.abs(h.laneX - slotX) < 1.5 &&
                Math.abs(h.group.position.z - rivalZ) < 2.6
              ) {
                const norm = 1 - Math.abs(h.group.position.z - rivalZ) / 2.6;
                rJumpY = Math.max(rJumpY, Math.sin(norm * Math.PI) * 1.25);
              }
            }
          }
          const rivalPhase = worldScrollZ * 1.3 + i * 0.9 + 1.2;
          const rLeftSin = Math.sin(rivalPhase);
          const rRightSin = -rLeftSin;
          const rBobY = Math.abs(Math.cos(rivalPhase)) * 0.08;

          rSprint.root.position.set(slotX, rJumpY + rBobY, rivalZ);
          rSprint.leftLeg.rotation.x = rLeftSin * 0.82;
          rSprint.rightLeg.rotation.x = rRightSin * 0.82;
          rSprint.leftKnee.rotation.x = Math.max(0.12, -rLeftSin * 0.7 + 0.42);
          rSprint.rightKnee.rotation.x = Math.max(0.12, -rRightSin * 0.7 + 0.42);
          rSprint.leftArm.rotation.x = rRightSin * 0.75;
          rSprint.rightArm.rotation.x = rLeftSin * 0.75;
          rSprint.leftElbow.rotation.x = -1.12 - Math.max(0, rRightSin) * 0.3;
          rSprint.rightElbow.rotation.x = -1.12 - Math.max(0, rLeftSin) * 0.3;
          rSprint.torso.rotation.x = -0.2;
          rSprint.torso.rotation.y = rLeftSin * 0.1;
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
      microBumpTex.dispose();
      carbonTex.dispose();
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
