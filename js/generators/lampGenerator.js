/* Texturizador - Ultra-High-Resolution Lamp Generator */

import * as THREE from 'three';

export const LAMP_PRESETS = {
  'pleated': {
    name: 'Origami Plisada (Accordion)',
    baseDiam: 115,
    topDiam: 88,
    height: 185,
    wallThickness: 1.26,
    socket: 'e14'
  },
  'spiral': {
    name: 'Hélice Espiral Torsión',
    baseDiam: 125,
    topDiam: 92,
    height: 195,
    wallThickness: 1.26,
    socket: 'e27'
  },
  'mushroom': {
    name: 'Bauhaus Seta (Mushroom)',
    baseDiam: 135,
    topDiam: 160,
    height: 180,
    wallThickness: 1.26,
    socket: 'bambu-led'
  },
  'wavy': {
    name: 'Ondas Sinusoidales 3D',
    baseDiam: 120,
    topDiam: 98,
    height: 190,
    wallThickness: 1.26,
    socket: 'e14'
  },
  'faceted': {
    name: 'Geométrica Facetada Diamante',
    baseDiam: 125,
    topDiam: 84,
    height: 175,
    wallThickness: 1.68,
    socket: 'e27'
  }
};

export const LAMP_SOCKETS = {
  'e14': { name: 'E14 (Rosca fina Ø28.5 mm)', holeDiameter: 28.5, recess: false },
  'e27': { name: 'E27 (Rosca estándar Ø41.0 mm)', holeDiameter: 41.0, recess: false },
  'bambu-led': { name: 'Bambu Lab LED Lamp Kit 001 (Ø60.5 mm)', holeDiameter: 60.5, recess: true },
  'vase': { name: 'Modo Jarrón / Abierta (Vase Mode)', holeDiameter: 0, recess: false, isVase: true }
};

export const CALIBRATED_WALLS = [
  { value: 0.84, label: '0.84 mm (2 perímetros sólidos boquilla 0.4)' },
  { value: 1.26, label: '1.26 mm (3 perímetros sólidos - recomendado)' },
  { value: 1.68, label: '1.68 mm (4 perímetros sólidos)' },
  { value: 2.10, label: '2.10 mm (5 perímetros sólidos)' }
];

/**
 * Generate high-resolution 3D modern lamp shade.
 */
export function generateLamp(params = {}) {
  const presetKey = params.preset || 'pleated';
  const preset = LAMP_PRESETS[presetKey] || LAMP_PRESETS.pleated;

  const height = Math.max(80, Math.min(320, Number(params.height) || preset.height));
  const baseDiam = Math.max(60, Math.min(260, Number(params.baseDiam) || preset.baseDiam));
  const topDiam = Math.max(30, Math.min(260, Number(params.topDiam) || preset.topDiam));
  const wallThickness = Math.max(0.8, Math.min(5.0, Number(params.wallThickness) || preset.wallThickness));
  const socketKey = params.socket || preset.socket;
  const socketInfo = LAMP_SOCKETS[socketKey] || LAMP_SOCKETS.e14;
  const cordNotch = params.cordNotch !== undefined ? Boolean(params.cordNotch) : (socketKey !== 'vase');
  const viewMode = params.viewMode || 'monoblock'; // 'monoblock', 'shade', 'base', 'assembled', 'plate-all'

  const R_base = baseDiam / 2;
  const R_top = topDiam / 2;

  // Ultra-fine resolution: 192 layers x 180 perimeters = 69,120 smooth triangles
  const nLayers = 192;
  const nPerim = 180;

  function getOuterRadius(z, theta) {
    const u = z / height; // 0 to 1
    let r0 = R_base + (R_top - R_base) * u;

    if (presetKey === 'pleated') {
      const numFolds = 24;
      const foldPhase = numFolds * theta;
      const triWave = (Math.abs(((foldPhase / Math.PI) % 2) - 1) - 0.5) * 2;
      const pleatAmp = 5.5 + 3.0 * Math.sin(u * Math.PI);
      return Math.max(16, r0 + triWave * pleatAmp);
    }

    if (presetKey === 'spiral') {
      const twistTurns = 0.55;
      const twistedTheta = theta - twistTurns * Math.PI * 2 * u;
      const flutes = 14;
      const fluteAmp = 5.0 * Math.sin(u * Math.PI * 0.95 + 0.05);
      return Math.max(16, r0 + Math.cos(flutes * twistedTheta) * fluteAmp);
    }

    if (presetKey === 'mushroom') {
      if (u < 0.42) {
        const stemT = u / 0.42;
        r0 = R_base * 0.52 + (R_base * 0.45) * Math.cos(stemT * Math.PI * 0.5);
      } else {
        const domeT = (u - 0.42) / 0.58;
        const domeBulge = Math.sin(domeT * Math.PI) * (R_top * 0.52);
        r0 = R_base * 0.52 + (R_top - R_base * 0.52) * domeT + domeBulge;
      }
      return Math.max(16, r0);
    }

    if (presetKey === 'wavy') {
      const wave1 = Math.sin(12 * theta) * Math.cos(u * Math.PI * 2) * 4.5;
      const wave2 = Math.sin(6 * theta + u * Math.PI * 3) * 3.5;
      return Math.max(16, r0 + wave1 + wave2);
    }

    if (presetKey === 'faceted') {
      const numFacets = 16;
      const layerStep = Math.floor(u * 24);
      const staggeredTheta = theta + (layerStep % 2) * (Math.PI / numFacets);
      const facetAmp = 5.5 * Math.sin(u * Math.PI);
      return Math.max(16, r0 + Math.cos(numFacets * staggeredTheta) * facetAmp);
    }

    return r0;
  }

  const positions = [];
  const uvs = [];

  function addQuad(p1, p2, p3, p4, uv1, uv2, uv3, uv4) {
    positions.push(p1.x, p1.y, p1.z);
    positions.push(p2.x, p2.y, p2.z);
    positions.push(p3.x, p3.y, p3.z);

    positions.push(p1.x, p1.y, p1.z);
    positions.push(p3.x, p3.y, p3.z);
    positions.push(p4.x, p4.y, p4.z);

    uvs.push(uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1]);
    uvs.push(uv1[0], uv1[1], uv3[0], uv3[1], uv4[0], uv4[1]);
  }

  // Precompute grid vertices
  const outerGrid = [];
  for (let j = 0; j <= nLayers; j++) {
    const z = (j / nLayers) * height;
    const row = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      let r = getOuterRadius(z, theta);
      if (cordNotch && z < 7.5) {
        const dTheta = Math.abs(theta < Math.PI ? theta : theta - Math.PI * 2);
        if (dTheta < 0.14) r = Math.max(r - 4.5, 16);
      }
      row.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, z));
    }
    outerGrid.push(row);
  }

  const innerGrid = [];
  for (let j = 0; j <= nLayers; j++) {
    const z = (j / nLayers) * height;
    const row = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      const rOuter = getOuterRadius(z, theta);
      const rInner = Math.max(12, rOuter - wallThickness);
      row.push(new THREE.Vector3(Math.cos(theta) * rInner, Math.sin(theta) * rInner, z));
    }
    innerGrid.push(row);
  }

  // 1. Outer Shell
  for (let j = 0; j < nLayers; j++) {
    const rowA = outerGrid[j];
    const rowB = outerGrid[j + 1];
    const v0 = j / nLayers, v1 = (j + 1) / nLayers;
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      const u0 = i / nPerim, u1 = (i + 1) / nPerim;
      addQuad(rowA[i], rowA[next], rowB[next], rowB[i], [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
    }
  }

  // 2. Inner Shell
  for (let j = 0; j < nLayers; j++) {
    const rowA = innerGrid[j];
    const rowB = innerGrid[j + 1];
    const v0 = j / nLayers, v1 = (j + 1) / nLayers;
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      const u0 = i / nPerim, u1 = (i + 1) / nPerim;
      addQuad(rowA[next], rowA[i], rowB[i], rowB[next], [u1, v0], [u0, v0], [u0, v1], [u1, v1]);
    }
  }

  // 3. Top Rim
  const outerTop = outerGrid[nLayers];
  const innerTop = innerGrid[nLayers];
  for (let i = 0; i < nPerim; i++) {
    const next = (i + 1) % nPerim;
    const u0 = i / nPerim, u1 = (i + 1) / nPerim;
    addQuad(outerTop[i], innerTop[i], innerTop[next], outerTop[next], [u0, 0], [u0, 1], [u1, 1], [u1, 0]);
  }

  // 4. Bottom Rim & Socket Mount
  const outerBottom = outerGrid[0];
  const innerBottom = innerGrid[0];

  if (socketInfo.isVase) {
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      const u0 = i / nPerim, u1 = (i + 1) / nPerim;
      addQuad(outerBottom[next], innerBottom[next], innerBottom[i], outerBottom[i], [u1, 0], [u1, 1], [u0, 1], [u0, 0]);
    }
  } else {
    const holeR = Math.min(socketInfo.holeDiameter / 2, R_base - 14);
    const mountZ = 4.5;

    const holeRing = [];
    const holeRingBottom = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      holeRing.push(new THREE.Vector3(Math.cos(theta) * holeR, Math.sin(theta) * holeR, mountZ));
      holeRingBottom.push(new THREE.Vector3(Math.cos(theta) * holeR, Math.sin(theta) * holeR, 0));
    }

    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      addQuad(outerBottom[next], holeRingBottom[next], holeRingBottom[i], outerBottom[i], [0,0], [1,0], [1,1], [0,1]);
    }

    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      addQuad(innerBottom[i], holeRing[i], holeRing[next], innerBottom[next], [0,0], [1,0], [1,1], [0,1]);
    }

    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      addQuad(holeRingBottom[i], holeRingBottom[next], holeRing[next], holeRing[i], [0,0], [1,0], [1,1], [0,1]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  geom.userData = {
    generator: 'lamp',
    name: `lampara_${presetKey}_${socketKey}`,
    dimensions: {
      diameter: Math.round(Math.max(baseDiam, topDiam) * 10) / 10,
      height: Math.round(height * 10) / 10
    },
    triangles: positions.length / 9
  };

  return geom;
}
