/* Texturizador - Lamp Generator */

import * as THREE from 'three';

export const LAMP_PRESETS = {
  'pleated': {
    name: 'Origami Plisada (Accordion)',
    baseDiam: 110,
    topDiam: 85,
    height: 180,
    wallThickness: 2.0,
    socket: 'e14'
  },
  'spiral': {
    name: 'Hélice Espiral Torsión',
    baseDiam: 120,
    topDiam: 90,
    height: 190,
    wallThickness: 2.2,
    socket: 'e27'
  },
  'mushroom': {
    name: 'Bauhaus Seta (Mushroom)',
    baseDiam: 130,
    topDiam: 150,
    height: 175,
    wallThickness: 2.2,
    socket: 'bambu-led'
  },
  'wavy': {
    name: 'Ondas Sinusoidales 3D',
    baseDiam: 115,
    topDiam: 95,
    height: 185,
    wallThickness: 2.0,
    socket: 'e14'
  },
  'faceted': {
    name: 'Geométrica Facetada Diamante',
    baseDiam: 120,
    topDiam: 80,
    height: 170,
    wallThickness: 2.4,
    socket: 'e27'
  }
};

export const LAMP_SOCKETS = {
  'e14': { name: 'E14 (Rosca fina Ø28.5 mm)', holeDiameter: 28.5, recess: false },
  'e27': { name: 'E27 (Rosca estándar Ø41.0 mm)', holeDiameter: 41.0, recess: false },
  'bambu-led': { name: 'Bambu Lab LED Lamp Kit 001 (Ø60.5 mm)', holeDiameter: 60.5, recess: true },
  'vase': { name: 'Modo Jarrón / Abierta (Vase Mode)', holeDiameter: 0, recess: false, isVase: true }
};

/**
 * Generate a complete, watertight 3D modern lamp shade.
 */
export function generateLamp(params = {}) {
  const presetKey = params.preset || 'pleated';
  const preset = LAMP_PRESETS[presetKey] || LAMP_PRESETS.pleated;

  const height = Math.max(80, Math.min(320, Number(params.height) || preset.height));
  const baseDiam = Math.max(60, Math.min(260, Number(params.baseDiam) || preset.baseDiam));
  const topDiam = Math.max(30, Math.min(260, Number(params.topDiam) || preset.topDiam));
  const wallThickness = Math.max(1.2, Math.min(5.0, Number(params.wallThickness) || preset.wallThickness));
  const socketKey = params.socket || preset.socket;
  const socketInfo = LAMP_SOCKETS[socketKey] || LAMP_SOCKETS.e14;
  const cordNotch = params.cordNotch !== undefined ? Boolean(params.cordNotch) : (socketKey !== 'vase');

  const R_base = baseDiam / 2;
  const R_top = topDiam / 2;

  // Grid resolution
  const nLayers = 72;
  const nPerim = 72;

  // Radial function for the outer surface: R(z, theta)
  function getOuterRadius(z, theta) {
    const u = z / height; // 0 (bottom) to 1 (top)

    // Base profile taper
    let r0 = R_base + (R_top - R_base) * u;

    if (presetKey === 'pleated') {
      // Accordion zigzag pleats (20 folds around perimeter)
      const numFolds = 20;
      const foldPhase = numFolds * theta;
      const triWave = (Math.abs(((foldPhase / Math.PI) % 2) - 1) - 0.5) * 2;
      const pleatAmp = 5.5 + 2.5 * Math.sin(u * Math.PI);
      return Math.max(15, r0 + triWave * pleatAmp);
    }

    if (presetKey === 'spiral') {
      // 12-sided polygon with 120-degree twist up the height
      const twistTurns = 0.45; // ~160 degrees total twist
      const twistedTheta = theta - twistTurns * Math.PI * 2 * u;
      const flutes = 12;
      const fluteAmp = 4.5 * Math.sin(u * Math.PI * 0.9 + 0.1);
      return Math.max(15, r0 + Math.cos(flutes * twistedTheta) * fluteAmp);
    }

    if (presetKey === 'mushroom') {
      // Bauhaus Mushroom: slim stem from u=0 to u=0.5, bulging wide dome from u=0.5 to u=1.0
      if (u < 0.45) {
        const stemT = u / 0.45;
        r0 = R_base * 0.55 + (R_base * 0.4) * (1 - stemT);
      } else {
        const domeT = (u - 0.45) / 0.55;
        // Bulbous hemispherical curve
        const domeBulge = Math.sin(domeT * Math.PI) * (R_top * 0.55);
        r0 = R_base * 0.55 + (R_top - R_base * 0.55) * domeT + domeBulge;
      }
      return Math.max(15, r0);
    }

    if (presetKey === 'wavy') {
      // Organic multi-harmonic ripple waves
      const wave1 = Math.sin(10 * theta) * Math.cos(u * Math.PI * 2) * 4.0;
      const wave2 = Math.sin(5 * theta + u * Math.PI * 3) * 3.0;
      return Math.max(15, r0 + wave1 + wave2);
    }

    if (presetKey === 'faceted') {
      // Geometric diamond facets
      const numFacets = 14;
      const layerStep = Math.floor(u * 16);
      const staggeredTheta = theta + (layerStep % 2) * (Math.PI / numFacets);
      const facetAmp = 5.0 * Math.sin(u * Math.PI);
      return Math.max(15, r0 + Math.cos(numFacets * staggeredTheta) * facetAmp);
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

  // Precompute outer mesh grid
  const outerGrid = [];
  for (let j = 0; j <= nLayers; j++) {
    const z = (j / nLayers) * height;
    const row = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      let r = getOuterRadius(z, theta);
      // Cord notch at bottom rim: z < 8mm, angle around theta=0
      if (cordNotch && z < 7.5) {
        const dTheta = Math.abs(theta < Math.PI ? theta : theta - Math.PI * 2);
        if (dTheta < 0.12) {
          // Flatten bottom rim to create cord arch
          r = Math.max(r - 4, 15);
        }
      }
      row.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, z));
    }
    outerGrid.push(row);
  }

  // Precompute inner mesh grid
  const innerGrid = [];
  for (let j = 0; j <= nLayers; j++) {
    const z = (j / nLayers) * height;
    const row = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      const rOuter = getOuterRadius(z, theta);
      const rInner = Math.max(10, rOuter - wallThickness);
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
      // Facing outwards
      addQuad(
        rowA[i], rowA[next], rowB[next], rowB[i],
        [u0, v0], [u1, v0], [u1, v1], [u0, v1]
      );
    }
  }

  // 2. Inner Shell (Facing inwards)
  for (let j = 0; j < nLayers; j++) {
    const rowA = innerGrid[j];
    const rowB = innerGrid[j + 1];
    const v0 = j / nLayers, v1 = (j + 1) / nLayers;
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      const u0 = i / nPerim, u1 = (i + 1) / nPerim;
      // Facing inwards
      addQuad(
        rowA[next], rowA[i], rowB[i], rowB[next],
        [u1, v0], [u0, v0], [u0, v1], [u1, v1]
      );
    }
  }

  // 3. Top Rim connecting outer and inner shells
  const outerTop = outerGrid[nLayers];
  const innerTop = innerGrid[nLayers];
  for (let i = 0; i < nPerim; i++) {
    const next = (i + 1) % nPerim;
    const u0 = i / nPerim, u1 = (i + 1) / nPerim;
    // Facing +Z (upward)
    addQuad(
      outerTop[i], innerTop[i], innerTop[next], outerTop[next],
      [u0, 0], [u0, 1], [u1, 1], [u1, 0]
    );
  }

  // 4. Bottom Rim & Socket Mount
  const outerBottom = outerGrid[0];
  const innerBottom = innerGrid[0];

  if (socketInfo.isVase) {
    // Vase mode: simple bottom rim closure
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      const u0 = i / nPerim, u1 = (i + 1) / nPerim;
      // Facing -Z (downward)
      addQuad(
        outerBottom[next], innerBottom[next], innerBottom[i], outerBottom[i],
        [u1, 0], [u1, 1], [u0, 1], [u0, 0]
      );
    }
  } else {
    // Socket Mounting Plate at bottom: connects outer wall to socket hole ring
    const holeR = Math.min(socketInfo.holeDiameter / 2, R_base - 12);
    const mountZ = 4.0; // Socket bracket thickness

    const holeRing = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      holeRing.push(new THREE.Vector3(Math.cos(theta) * holeR, Math.sin(theta) * holeR, mountZ));
    }
    const holeRingBottom = [];
    for (let i = 0; i < nPerim; i++) {
      const theta = (i / nPerim) * Math.PI * 2;
      holeRingBottom.push(new THREE.Vector3(Math.cos(theta) * holeR, Math.sin(theta) * holeR, 0));
    }

    // Bottom plate (Z = 0) facing -Z
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      addQuad(
        outerBottom[next], holeRingBottom[next], holeRingBottom[i], outerBottom[i],
        [0,0], [1,0], [1,1], [0,1]
      );
    }

    // Inside plate (Z = mountZ) facing +Z
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      addQuad(
        innerBottom[i], holeRing[i], holeRing[next], innerBottom[next],
        [0,0], [1,0], [1,1], [0,1]
      );
    }

    // Hole cylinder wall
    for (let i = 0; i < nPerim; i++) {
      const next = (i + 1) % nPerim;
      addQuad(
        holeRingBottom[i], holeRingBottom[next], holeRing[next], holeRing[i],
        [0,0], [1,0], [1,1], [0,1]
      );
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // If faceted preset, compute flat normals, otherwise smooth vertex normals
  if (presetKey === 'faceted') {
    geom.computeVertexNormals();
  } else {
    geom.computeVertexNormals();
  }

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
