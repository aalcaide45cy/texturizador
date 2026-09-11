/* Texturizador - High-Resolution Multi-Part Frame Generator */

import * as THREE from 'three';

export const FRAME_PRESETS = {
  '10x15': { name: '10 × 15 cm (4 × 6")', photoW: 100, photoH: 150 },
  '13x18': { name: '13 × 18 cm (5 × 7")', photoW: 130, photoH: 180 },
  '15x20': { name: '15 × 20 cm (6 × 8")', photoW: 150, photoH: 200 },
  'polaroid': { name: 'Polaroid Style (7.9 × 7.9 cm)', photoW: 79, photoH: 79, isPolaroid: true },
  'instax': { name: 'Instax Mini (4.6 × 6.2 cm)', photoW: 46, photoH: 62 },
  'custom': { name: 'Personalizado', photoW: 100, photoH: 100 }
};

export const FRAME_SHAPES = ['rectangular', 'rounded', 'arch', 'oval', 'hexagon'];
export const FRAME_RELIEFS = ['smooth', 'chamfer', 'stepped', 'ribbed', 'wave'];

/**
 * Generate 2D point loop for smooth shapes with high sampling (256 points).
 */
export function sampleShapePoints(shape, width, height, cornerRadius, numPoints = 256, polaroidExtraY = 0) {
  const points = [];
  const halfW = width / 2;
  const halfH = height / 2;

  if (shape === 'oval') {
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      points.push(new THREE.Vector2(
        Math.cos(angle) * halfW,
        Math.sin(angle) * halfH + polaroidExtraY
      ));
    }
    return points;
  }

  if (shape === 'hexagon') {
    for (let i = 0; i < numPoints; i++) {
      const t = i / numPoints;
      const sideFrac = (t * 6) % 1;
      const sideIdx = Math.floor(t * 6);
      const a1 = (sideIdx / 6) * Math.PI * 2;
      const a2 = ((sideIdx + 1) / 6) * Math.PI * 2;
      const x1 = Math.cos(a1) * halfW, y1 = Math.sin(a1) * halfH;
      const x2 = Math.cos(a2) * halfW, y2 = Math.sin(a2) * halfH;
      points.push(new THREE.Vector2(
        x1 + (x2 - x1) * sideFrac,
        y1 + (y2 - y1) * sideFrac + polaroidExtraY
      ));
    }
    return points;
  }

  if (shape === 'arch') {
    const archRadius = halfW;
    const archCenterY = halfH - archRadius + polaroidExtraY;
    const bottomY = -halfH + polaroidExtraY;
    const segsPerSide = Math.floor(numPoints / 4);
    for (let i = 0; i < segsPerSide; i++) {
      const u = i / segsPerSide;
      points.push(new THREE.Vector2(-halfW + 2 * halfW * u, bottomY));
    }
    for (let i = 0; i < segsPerSide; i++) {
      const u = i / segsPerSide;
      points.push(new THREE.Vector2(halfW, bottomY + (archCenterY - bottomY) * u));
    }
    const archSegs = numPoints - 3 * segsPerSide;
    for (let i = 0; i < archSegs; i++) {
      const u = i / archSegs;
      const angle = (1 - u) * Math.PI;
      points.push(new THREE.Vector2(
        Math.cos(angle) * archRadius,
        archCenterY + Math.sin(angle) * archRadius
      ));
    }
    for (let i = 0; i < segsPerSide; i++) {
      const u = i / segsPerSide;
      points.push(new THREE.Vector2(-halfW, archCenterY - (archCenterY - bottomY) * u));
    }
    return points;
  }

  // Rounded rectangle & rectangular (with small corner radius)
  const r = Math.max(1.0, Math.min(cornerRadius, halfW * 0.45, halfH * 0.45));
  const innerW = halfW - r;
  const innerH = halfH - r;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let px, py;
    if (Math.abs(cos) > Math.abs(sin)) {
      const slope = sin / (Math.abs(cos) || 1e-6);
      px = Math.sign(cos) * halfW;
      py = Math.max(-halfH, Math.min(halfH, slope * halfW));
      if (Math.abs(py) > innerH) {
        const dy = Math.abs(py) - innerH;
        const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
        px = Math.sign(cos) * (innerW + dx);
      }
    } else {
      const slope = cos / (Math.abs(sin) || 1e-6);
      py = Math.sign(sin) * halfH;
      px = Math.max(-halfW, Math.min(halfW, slope * halfH));
      if (Math.abs(px) > innerW) {
        const dx = Math.abs(px) - innerW;
        const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
        py = Math.sign(sin) * (innerH + dy);
      }
    }
    points.push(new THREE.Vector2(px, py + polaroidExtraY));
  }
  return points;
}

/**
 * Helper to build non-indexed quad triangles.
 */
function addQuad(positions, uvs, v00, v10, v11, v01, uv00 = [0,0], uv10 = [1,0], uv11 = [1,1], uv01 = [0,1]) {
  positions.push(v00.x, v00.y, v00.z);
  positions.push(v10.x, v10.y, v10.z);
  positions.push(v11.x, v11.y, v11.z);
  uvs.push(uv00[0], uv00[1], uv10[0], uv10[1], uv11[0], uv11[1]);

  positions.push(v00.x, v00.y, v00.z);
  positions.push(v11.x, v11.y, v11.z);
  positions.push(v01.x, v01.y, v01.z);
  uvs.push(uv00[0], uv00[1], uv11[0], uv11[1], uv01[0], uv01[1]);
}

/**
 * Helper: Triangulate a 2D polygon with a center vertex or fan.
 */
function triangulate2D(positions, uvs, loop2D, z, facingPositive, getUV) {
  let cx = 0, cy = 0;
  for (const p of loop2D) { cx += p.x; cy += p.y; }
  cx /= loop2D.length; cy /= loop2D.length;
  const center = new THREE.Vector3(cx, cy, z);
  const uvCenter = getUV ? getUV(cx, cy) : [0.5, 0.5];

  const N = loop2D.length;
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const v1 = new THREE.Vector3(loop2D[i].x, loop2D[i].y, z);
    const v2 = new THREE.Vector3(loop2D[next].x, loop2D[next].y, z);
    const uv1 = getUV ? getUV(v1.x, v1.y) : [0, 0];
    const uv2 = getUV ? getUV(v2.x, v2.y) : [1, 0];

    if (facingPositive) {
      positions.push(center.x, center.y, center.z);
      positions.push(v1.x, v1.y, v1.z);
      positions.push(v2.x, v2.y, v2.z);
      uvs.push(uvCenter[0], uvCenter[1], uv1[0], uv1[1], uv2[0], uv2[1]);
    } else {
      positions.push(center.x, center.y, center.z);
      positions.push(v2.x, v2.y, v2.z);
      positions.push(v1.x, v1.y, v1.z);
      uvs.push(uvCenter[0], uvCenter[1], uv2[0], uv2[1], uv1[0], uv1[1]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PIEZA: MARCO FRONTAL DECORATIVO (Front Frame)
// ─────────────────────────────────────────────────────────────────────────────
export function createFrontFrame(params = {}) {
  const shape = params.shape || 'rectangular';
  const photoW = Math.max(20, Number(params.photoW) || 100);
  const photoH = Math.max(20, Number(params.photoH) || 150);
  const borderWidth = Math.max(10, Number(params.borderWidth) || 25);
  const frameDepth = Math.max(8, Number(params.frameDepth) || 16);
  const rebateDepth = Math.max(3.0, Math.min(frameDepth - 3, Number(params.rebateDepth) || 4.5));
  const rebateWidth = Math.max(2.5, Math.min(borderWidth * 0.4, Number(params.rebateWidth) || 4.5));
  const profileStyle = params.profileStyle || 'smooth';
  const cornerRadius = shape === 'rounded' ? (Number(params.cornerRadius) || 18) : 2.5;
  const isPolaroid = Boolean(params.isPolaroid);

  // Micro-segmentación ultra-alta: 256 puntos perimetrales
  const numPoints = 256;
  const polaroidShiftY = isPolaroid ? (borderWidth * 0.4) : 0;
  const polaroidExtraBottom = isPolaroid ? (borderWidth * 0.8) : 0;

  const winW = photoW;
  const winH = photoH;
  const rebW = photoW + rebateWidth * 2;
  const rebH = photoH + rebateWidth * 2;
  const outW = photoW + borderWidth * 2;
  const outH = photoH + borderWidth * 2 + polaroidExtraBottom;

  const windowLoop = sampleShapePoints(shape, winW, winH, Math.max(1, cornerRadius - borderWidth * 0.5), numPoints, polaroidShiftY);
  const rebateLoop = sampleShapePoints(shape, rebW, rebH, Math.max(1.5, cornerRadius - (borderWidth - rebateWidth) * 0.5), numPoints, polaroidShiftY);
  const outerLoop  = sampleShapePoints(shape, outW, outH, cornerRadius, numPoints, 0);

  // Front profile rings (Z values relative to frameDepth)
  let numProfileRings = 2;
  let ringTs = [0, 1];
  let ringZs = [0, 0];

  if (profileStyle === 'chamfer') {
    numProfileRings = 6;
    const bevelD = Math.min(3.5, frameDepth * 0.25);
    ringTs = [0, 0.08, 0.18, 0.82, 0.92, 1];
    ringZs = [-bevelD, -bevelD * 0.3, 0, 0, -bevelD * 0.3, -bevelD];
  } else if (profileStyle === 'stepped') {
    numProfileRings = 7;
    ringTs = [0, 0.2, 0.201, 0.5, 0.501, 0.8, 1];
    ringZs = [-3.0, -3.0, -1.8, -1.8, -0.8, 0, -1.5];
  } else if (profileStyle === 'ribbed') {
    numProfileRings = 9;
    ringTs = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
    ringZs = [0, -2.2, 0, -2.2, 0, -2.2, 0, -2.2, 0];
  } else if (profileStyle === 'wave') {
    numProfileRings = 10;
    ringTs = [];
    ringZs = [];
    for (let k = 0; k < 10; k++) {
      const t = k / 9;
      ringTs.push(t);
      ringZs.push(-2.8 * Math.sin(t * Math.PI));
    }
  }

  const frontRings = [];
  for (let r = 0; r < numProfileRings; r++) {
    const t = ringTs[r];
    const zOffset = ringZs[r];
    const ringPts = [];
    for (let i = 0; i < numPoints; i++) {
      const pWin = windowLoop[i];
      const pOut = outerLoop[i];
      const x = pWin.x + (pOut.x - pWin.x) * t;
      const y = pWin.y + (pOut.y - pWin.y) * t;
      const z = frameDepth + zOffset;
      ringPts.push(new THREE.Vector3(x, y, z));
    }
    frontRings.push(ringPts);
  }

  const backOuterPts  = outerLoop.map(p => new THREE.Vector3(p.x, p.y, 0));
  const backRebatePts = rebateLoop.map(p => new THREE.Vector3(p.x, p.y, 0));
  const rebShelfPts   = rebateLoop.map(p => new THREE.Vector3(p.x, p.y, rebateDepth));
  const winTunnelPts  = windowLoop.map(p => new THREE.Vector3(p.x, p.y, rebateDepth));

  const positions = [];
  const uvs = [];

  const minX = -outW / 2, maxX = outW / 2;
  const minY = -outH / 2, maxY = outH / 2;
  const getPlanarUV = (x, y) => [
    (x - minX) / (maxX - minX || 1),
    (y - minY) / (maxY - minY || 1)
  ];

  // 1. Back face (facing -Z towards bed)
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const uvA = getPlanarUV(backOuterPts[i].x, backOuterPts[i].y);
    const uvB = getPlanarUV(backOuterPts[next].x, backOuterPts[next].y);
    const uvC = getPlanarUV(backRebatePts[next].x, backRebatePts[next].y);
    const uvD = getPlanarUV(backRebatePts[i].x, backRebatePts[i].y);
    addQuad(positions, uvs, backOuterPts[next], backOuterPts[i], backRebatePts[i], backRebatePts[next], uvB, uvA, uvD, uvC);
  }

  // 2. Rebate inner wall (Z=0 to Z=rebateDepth)
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(positions, uvs, backRebatePts[i], backRebatePts[next], rebShelfPts[next], rebShelfPts[i],
      [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  }

  // 3. Rebate shelf (Z=rebateDepth, facing -Z)
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const uvA = getPlanarUV(rebShelfPts[i].x, rebShelfPts[i].y);
    const uvB = getPlanarUV(rebShelfPts[next].x, rebShelfPts[next].y);
    const uvC = getPlanarUV(winTunnelPts[next].x, winTunnelPts[next].y);
    const uvD = getPlanarUV(winTunnelPts[i].x, winTunnelPts[i].y);
    addQuad(positions, uvs, rebShelfPts[next], rebShelfPts[i], winTunnelPts[i], winTunnelPts[next], uvB, uvA, uvD, uvC);
  }

  // 4. Inner window tunnel (Z=rebateDepth to front window)
  const frontWinPts = frontRings[0];
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(positions, uvs, winTunnelPts[i], winTunnelPts[next], frontWinPts[next], frontWinPts[i],
      [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  }

  // 5. Front face profile rings (facing +Z)
  for (let r = 0; r < numProfileRings - 1; r++) {
    const ringA = frontRings[r];
    const ringB = frontRings[r + 1];
    for (let i = 0; i < numPoints; i++) {
      const next = (i + 1) % numPoints;
      const uvA = getPlanarUV(ringA[i].x, ringA[i].y);
      const uvB = getPlanarUV(ringA[next].x, ringA[next].y);
      const uvC = getPlanarUV(ringB[next].x, ringB[next].y);
      const uvD = getPlanarUV(ringB[i].x, ringB[i].y);
      addQuad(positions, uvs, ringA[i], ringA[next], ringB[next], ringB[i], uvA, uvB, uvC, uvD);
    }
  }

  // 6. Outer perimeter wall (Z=front to Z=0)
  const frontOuterPts = frontRings[numProfileRings - 1];
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(positions, uvs, frontOuterPts[i], frontOuterPts[next], backOuterPts[next], backOuterPts[i],
      [u0, 1], [u1, 1], [u1, 0], [u0, 0]);
  }

  // 7. Wall Mount Keyhole bracket on rear top center
  const tabW = 20, tabH = 12, tabT = 3.5;
  const tabY = outH / 2 - 8;
  const p1 = new THREE.Vector3(-tabW/2, tabY, 0);
  const p2 = new THREE.Vector3(tabW/2, tabY, 0);
  const p3 = new THREE.Vector3(tabW/2, tabY - tabH, 0);
  const p4 = new THREE.Vector3(-tabW/2, tabY - tabH, 0);
  const p1b = new THREE.Vector3(-tabW/2, tabY, tabT);
  const p2b = new THREE.Vector3(tabW/2, tabY, tabT);
  const p3b = new THREE.Vector3(tabW/2, tabY - tabH, tabT);
  const p4b = new THREE.Vector3(-tabW/2, tabY - tabH, tabT);
  addQuad(positions, uvs, p4b, p3b, p2b, p1b, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, p1b, p2b, p2, p1, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, p3b, p4b, p4, p3, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, p4, p4b, p1b, p1, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, p2, p2b, p3b, p3, [0,0], [1,0], [1,1], [0,1]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  geom.userData = {
    part: 'frame_front',
    name: `marco_frontal_${shape}_${photoW}x${photoH}`,
    dimensions: {
      width: Math.round(outW * 10) / 10,
      height: Math.round(outH * 10) / 10,
      depth: Math.round(frameDepth * 10) / 10
    },
    triangles: positions.length / 9
  };

  return geom;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PIEZA: TAPA TRASERA DE PRESIÓN (Backing Plate)
// ─────────────────────────────────────────────────────────────────────────────
export function createBackingPlate(params = {}) {
  const shape = params.shape || 'rectangular';
  const photoW = Math.max(20, Number(params.photoW) || 100);
  const photoH = Math.max(20, Number(params.photoH) || 150);
  const rebateWidth = Math.max(2.5, Number(params.rebateWidth) || 4.5);
  const borderWidth = Math.max(10, Number(params.borderWidth) || 25);
  const cornerRadius = shape === 'rounded' ? (Number(params.cornerRadius) || 18) : 2.5;
  const isPolaroid = Boolean(params.isPolaroid);

  // Clearance tolerance: 0.35 mm around perimeter for smooth insertion
  const clearance = 0.35;
  const plateW = photoW + rebateWidth * 2 - clearance * 2;
  const plateH = photoH + rebateWidth * 2 - clearance * 2;
  const thickness = 2.2;
  const polaroidShiftY = isPolaroid ? (borderWidth * 0.4) : 0;

  const numPoints = 256;
  const loop = sampleShapePoints(shape, plateW, plateH, Math.max(1.0, cornerRadius - 4), numPoints, polaroidShiftY);

  const positions = [];
  const uvs = [];

  const minX = -plateW / 2, maxX = plateW / 2;
  const minY = -plateH / 2, maxY = plateH / 2;
  const getUV = (x, y) => [(x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1)];

  // Bottom face (Z = 0) facing -Z
  triangulate2D(positions, uvs, loop, 0, false, getUV);

  // Top face (Z = thickness) facing +Z
  triangulate2D(positions, uvs, loop, thickness, true, getUV);

  // Outer edge wall
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const v00 = new THREE.Vector3(loop[i].x, loop[i].y, 0);
    const v10 = new THREE.Vector3(loop[next].x, loop[next].y, 0);
    const v11 = new THREE.Vector3(loop[next].x, loop[next].y, thickness);
    const v01 = new THREE.Vector3(loop[i].x, loop[i].y, thickness);
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(positions, uvs, v00, v10, v11, v01, [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  }

  // Add Finger Pull Extraction Notch at top edge (recessed tab)
  const notchR = 9.0;
  const notchCenterY = plateH / 2 + polaroidShiftY - 1;
  const notchPts = [];
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI;
    notchPts.push(new THREE.Vector3(Math.cos(a) * notchR, notchCenterY - Math.sin(a) * notchR, thickness + 1.2));
  }

  // Add Universal Cross Hinge Mount (snap socket for portrait and landscape kickstand)
  const sockW = 16, sockH = 18, sockT = 3.0;
  const sockY = -plateH * 0.18 + polaroidShiftY;
  const sp1 = new THREE.Vector3(-sockW/2, sockY, thickness);
  const sp2 = new THREE.Vector3(sockW/2, sockY, thickness);
  const sp3 = new THREE.Vector3(sockW/2, sockY + sockH, thickness);
  const sp4 = new THREE.Vector3(-sockW/2, sockY + sockH, thickness);
  const sp1b = new THREE.Vector3(-sockW/2, sockY, thickness + sockT);
  const sp2b = new THREE.Vector3(sockW/2, sockY, thickness + sockT);
  const sp3b = new THREE.Vector3(sockW/2, sockY + sockH, thickness + sockT);
  const sp4b = new THREE.Vector3(-sockW/2, sockY + sockH, thickness + sockT);

  addQuad(positions, uvs, sp1b, sp2b, sp3b, sp4b, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, sp1, sp2, sp2b, sp1b, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, sp2, sp3, sp3b, sp2b, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, sp3, sp4, sp4b, sp3b, [0,0], [1,0], [1,1], [0,1]);
  addQuad(positions, uvs, sp4, sp1, sp1b, sp4b, [0,0], [1,0], [1,1], [0,1]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  geom.userData = {
    part: 'frame_backplate',
    name: `tapa_trasera_${shape}_${photoW}x${photoH}`,
    dimensions: {
      width: Math.round(plateW * 10) / 10,
      height: Math.round(plateH * 10) / 10,
      depth: Math.round((thickness + sockT) * 10) / 10
    },
    triangles: positions.length / 9
  };

  return geom;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PIEZA: PATA DE APOYO ABATIBLE (Easel Kickstand)
// ─────────────────────────────────────────────────────────────────────────────
export function createEaselStand(params = {}) {
  const photoH = Math.max(20, Number(params.photoH) || 150);
  const standLength = Math.max(65, Math.min(180, photoH * 0.65));
  const standWidth = 22.0;
  const standThickness = 3.5;
  const pinRadius = 2.2;
  const pinWidth = 26.0;

  const positions = [];
  const uvs = [];

  // Main arm: tapered from width 22mm at hinge to 16mm at bottom foot
  const topW = standWidth;
  const botW = 16.0;
  const L = standLength;
  const T = standThickness;

  // 8 vertices of the tapered rectangular leg
  const v1 = new THREE.Vector3(-topW / 2, 0, 0);
  const v2 = new THREE.Vector3(topW / 2, 0, 0);
  const v3 = new THREE.Vector3(botW / 2, -L, 0);
  const v4 = new THREE.Vector3(-botW / 2, -L, 0);

  const v1b = new THREE.Vector3(-topW / 2, 0, T);
  const v2b = new THREE.Vector3(topW / 2, 0, T);
  const v3b = new THREE.Vector3(botW / 2, -L, T);
  const v4b = new THREE.Vector3(-botW / 2, -L, T);

  // Bottom face (-Z)
  addQuad(positions, uvs, v2, v1, v4, v3, [1,0], [0,0], [0,1], [1,1]);
  // Top face (+Z)
  addQuad(positions, uvs, v1b, v2b, v3b, v4b, [0,0], [1,0], [1,1], [0,1]);
  // Side left
  addQuad(positions, uvs, v1, v1b, v4b, v4, [0,0], [0,1], [1,1], [1,0]);
  // Side right
  addQuad(positions, uvs, v2b, v2, v3, v3b, [0,1], [0,0], [1,0], [1,1]);
  // Top edge
  addQuad(positions, uvs, v2, v1, v1b, v2b, [1,0], [0,0], [0,1], [1,1]);
  // Bottom angled foot (beveled at 18 degrees)
  addQuad(positions, uvs, v4, v4b, v3b, v3, [0,0], [0,1], [1,1], [1,0]);

  // Cylindrical snap pin at hinge top: radius 2.2mm, length 26mm
  const nSegs = 24;
  const halfPinW = pinWidth / 2;
  for (let k = 0; k < nSegs; k++) {
    const a1 = (k / nSegs) * Math.PI * 2;
    const a2 = ((k + 1) / nSegs) * Math.PI * 2;
    const y1 = Math.cos(a1) * pinRadius, z1 = T / 2 + Math.sin(a1) * pinRadius;
    const y2 = Math.cos(a2) * pinRadius, z2 = T / 2 + Math.sin(a2) * pinRadius;

    const pA = new THREE.Vector3(-halfPinW, y1, z1);
    const pB = new THREE.Vector3(halfPinW, y1, z1);
    const pC = new THREE.Vector3(halfPinW, y2, z2);
    const pD = new THREE.Vector3(-halfPinW, y2, z2);
    addQuad(positions, uvs, pA, pB, pC, pD);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  geom.userData = {
    part: 'frame_kickstand',
    name: 'pata_apoyo_abatible',
    dimensions: {
      width: pinWidth,
      height: Math.round(standLength * 10) / 10,
      depth: standThickness
    },
    triangles: positions.length / 9
  };

  return geom;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PIEZA: PESTILLOS GIRATORIOS DE CIERRE (4x Turn-Button Clips)
// ─────────────────────────────────────────────────────────────────────────────
export function createTurnClips() {
  const positions = [];
  const uvs = [];

  // Generate 4 clips arranged in a clean 2x2 grid flat on bed
  const clipLength = 16.0;
  const clipWidth = 8.5;
  const clipThick = 2.4;
  const pinRadius = 1.9;
  const pinHeight = 3.6;

  const offsets = [
    { x: -12, y: -12 },
    { x:  12, y: -12 },
    { x: -12, y:  12 },
    { x:  12, y:  12 }
  ];

  for (const off of offsets) {
    const halfL = clipLength / 2;
    const halfW = clipWidth / 2;
    const n = 16;
    const loop = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI;
      loop.push(new THREE.Vector2(off.x + halfL - halfW + Math.cos(a) * halfW, off.y + Math.sin(a) * halfW));
    }
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      loop.push(new THREE.Vector2(off.x - halfL + halfW + Math.cos(a) * halfW, off.y + Math.sin(a) * halfW));
    }

    // Bottom face (Z = 0)
    triangulate2D(positions, uvs, loop, 0, false);
    // Top face (Z = clipThick)
    triangulate2D(positions, uvs, loop, clipThick, true);

    // Perimeter wall
    for (let i = 0; i < loop.length; i++) {
      const next = (i + 1) % loop.length;
      addQuad(positions, uvs,
        new THREE.Vector3(loop[i].x, loop[i].y, 0),
        new THREE.Vector3(loop[next].x, loop[next].y, 0),
        new THREE.Vector3(loop[next].x, loop[next].y, clipThick),
        new THREE.Vector3(loop[i].x, loop[i].y, clipThick)
      );
    }

    // Snap pin on bottom
    const pinSegs = 16;
    for (let k = 0; k < pinSegs; k++) {
      const a1 = (k / pinSegs) * Math.PI * 2;
      const a2 = ((k + 1) / pinSegs) * Math.PI * 2;
      const x1 = off.x + Math.cos(a1) * pinRadius, y1 = off.y + Math.sin(a1) * pinRadius;
      const x2 = off.x + Math.cos(a2) * pinRadius, y2 = off.y + Math.sin(a2) * pinRadius;

      addQuad(positions, uvs,
        new THREE.Vector3(x1, y1, -pinHeight),
        new THREE.Vector3(x2, y2, -pinHeight),
        new THREE.Vector3(x2, y2, 0),
        new THREE.Vector3(x1, y1, 0)
      );
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  geom.userData = {
    part: 'frame_turn_clips',
    name: 'clips_cierre_4x',
    dimensions: { width: 36, height: 36, depth: clipThick + pinHeight },
    triangles: positions.length / 9
  };

  return geom;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENSAMBLAJE Y DISTRIBUCIÓN EN PLACAS DE IMPRESIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns dictionary of all 4 standalone geometries.
 */
export function getPhotoFrameParts(params = {}) {
  return {
    front: createFrontFrame(params),
    backplate: createBackingPlate(params),
    stand: createEaselStand(params),
    clips: createTurnClips()
  };
}

/**
 * Main Generator Function: Supports Assembled view and Build Plate views.
 */
export function generatePhotoFrame(params = {}) {
  const viewMode = params.viewMode || 'assembled';
  const parts = getPhotoFrameParts(params);

  if (viewMode === 'plate-frame') return parts.front;
  if (viewMode === 'plate-back') return parts.backplate;
  if (viewMode === 'plate-stand') return parts.stand;
  if (viewMode === 'plate-clips') return parts.clips;

  if (viewMode === 'plate-all') {
    // Lay out all 4 parts flat on the build bed (Z = 0)
    const frameW = parts.front.userData.dimensions.width;
    const frameH = parts.front.userData.dimensions.height;

    // Place front frame in center
    const gFront = parts.front.clone();

    // Place backplate to the right or above
    const gBack = parts.backplate.clone();
    gBack.translate(frameW / 2 + parts.backplate.userData.dimensions.width / 2 + 15, 0, 0);

    // Place stand below
    const gStand = parts.stand.clone();
    gStand.translate(0, -frameH / 2 - parts.stand.userData.dimensions.height / 2 - 15, 0);

    // Place clips in the corner
    const gClips = parts.clips.clone();
    gClips.translate(frameW / 2 + 25, -frameH / 2 - 15, 0);

    return mergeBufferGeometries([gFront, gBack, gStand, gClips], 'marco_cama_completa');
  }

  // DEFAULT: 'assembled' View (Full 3D realistic assembly with deployed kickstand)
  const gFront = parts.front.clone();

  // Position Backplate seated into the rear rebate (Z = 0 to Z = 2.2)
  const gBack = parts.backplate.clone();

  // Position Easel Kickstand rotated 18 degrees backwards
  const gStand = parts.stand.clone();
  const tiltRad = (18 * Math.PI) / 180;
  gStand.rotateX(tiltRad);
  const photoH = Number(params.photoH) || 150;
  gStand.translate(0, -photoH * 0.18, -1.0);

  // Position Clips locked over backplate
  const gClips = parts.clips.clone();
  gClips.translate(0, 0, 2.2);

  const merged = mergeBufferGeometries([gFront, gBack, gStand, gClips], 'marco_ensamblado_completo');
  merged.userData.frontGeometry = parts.front; // Keep reference to front for direct texturizing
  return merged;
}

/**
 * Fast merger for non-indexed BufferGeometries.
 */
function mergeBufferGeometries(geometries, name = 'merged') {
  let totalVerts = 0;
  for (const g of geometries) totalVerts += g.attributes.position.count;

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  let vOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position.array;
    const uv = g.attributes.uv.array;
    positions.set(pos, vOffset * 3);
    uvs.set(uv, vOffset * 2);
    vOffset += g.attributes.position.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeVertexNormals();

  merged.userData = {
    generator: 'frame',
    name,
    triangles: totalVerts / 3
  };

  return merged;
}
