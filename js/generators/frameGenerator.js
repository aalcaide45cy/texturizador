/* Texturizador - Frame Generator */

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
 * Generate 2D point loop for frame profiles.
 */
function sampleShapePoints(shape, width, height, cornerRadius, numPoints, polaroidExtraY = 0) {
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
    // Bottom half rectangular, top half semicircular arch
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

  // Rounded rectangle & rectangular (small corner radius)
  const r = Math.max(0.5, Math.min(cornerRadius, halfW * 0.45, halfH * 0.45));
  const innerW = halfW - r;
  const innerH = halfH - r;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let px = Math.sign(cos) * innerW + cos * r;
    let py = Math.sign(sin) * innerH + sin * r;
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
 * Generate a complete, watertight 3D photo frame.
 */
export function generatePhotoFrame(params = {}) {
  const shape = params.shape || 'rectangular';
  const photoW = Math.max(20, Number(params.photoW) || 100);
  const photoH = Math.max(20, Number(params.photoH) || 150);
  const borderWidth = Math.max(10, Number(params.borderWidth) || 25);
  const frameDepth = Math.max(6, Number(params.frameDepth) || 16);
  const rebateDepth = Math.max(2, Math.min(frameDepth - 3, Number(params.rebateDepth) || 4));
  const rebateWidth = Math.max(2, Math.min(borderWidth * 0.4, Number(params.rebateWidth) || 4));
  const profileStyle = params.profileStyle || 'smooth';
  const cornerRadius = shape === 'rounded' ? (Number(params.cornerRadius) || 16) : 2;
  const kickstand = Boolean(params.kickstand);
  const wallMount = Boolean(params.wallMount);
  const isPolaroid = Boolean(params.isPolaroid);

  const numPoints = 64;
  const polaroidShiftY = isPolaroid ? (borderWidth * 0.4) : 0;
  const polaroidExtraBottom = isPolaroid ? (borderWidth * 0.8) : 0;

  // 1. Dimensions
  const winW = photoW;
  const winH = photoH;
  const rebW = photoW + rebateWidth * 2;
  const rebH = photoH + rebateWidth * 2;
  const outW = photoW + borderWidth * 2;
  const outH = photoH + borderWidth * 2 + polaroidExtraBottom;

  // 2. Loops of 2D points
  const windowLoop = sampleShapePoints(shape, winW, winH, Math.max(1, cornerRadius - borderWidth * 0.5), numPoints, polaroidShiftY);
  const rebateLoop = sampleShapePoints(shape, rebW, rebH, Math.max(1.5, cornerRadius - (borderWidth - rebateWidth) * 0.5), numPoints, polaroidShiftY);
  const outerLoop  = sampleShapePoints(shape, outW, outH, cornerRadius, numPoints, 0);

  // Front profile rings: between windowLoop (t=0) and outerLoop (t=1)
  let numProfileRings = 2;
  let ringTs = [0, 1];
  let ringZs = [0, 0];

  if (profileStyle === 'chamfer') {
    numProfileRings = 4;
    const bevelD = Math.min(3.5, frameDepth * 0.25);
    ringTs = [0, 0.15, 0.85, 1];
    ringZs = [-bevelD, 0, 0, -bevelD];
  } else if (profileStyle === 'stepped') {
    numProfileRings = 5;
    ringTs = [0, 0.25, 0.5, 0.75, 1];
    ringZs = [-3.0, -2.0, -1.0, 0, -1.5];
  } else if (profileStyle === 'ribbed') {
    numProfileRings = 7;
    ringTs = [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1];
    ringZs = [0, -2.0, 0, -2.0, 0, -2.0, 0];
  } else if (profileStyle === 'wave') {
    numProfileRings = 6;
    ringTs = [0, 0.2, 0.4, 0.6, 0.8, 1];
    ringZs = ringTs.map(t => -2.5 * Math.sin(t * Math.PI));
  }

  // Construct concentric rings for the front face
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

  function addQuad(v00, v10, v11, v01, uv00, uv10, uv11, uv01) {
    positions.push(v00.x, v00.y, v00.z);
    positions.push(v10.x, v10.y, v10.z);
    positions.push(v11.x, v11.y, v11.z);
    uvs.push(uv00[0], uv00[1], uv10[0], uv10[1], uv11[0], uv11[1]);

    positions.push(v00.x, v00.y, v00.z);
    positions.push(v11.x, v11.y, v11.z);
    positions.push(v01.x, v01.y, v01.z);
    uvs.push(uv00[0], uv00[1], uv11[0], uv11[1], uv01[0], uv01[1]);
  }

  // 1. Back face (facing -Z)
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const uvA = getPlanarUV(backOuterPts[i].x, backOuterPts[i].y);
    const uvB = getPlanarUV(backOuterPts[next].x, backOuterPts[next].y);
    const uvC = getPlanarUV(backRebatePts[next].x, backRebatePts[next].y);
    const uvD = getPlanarUV(backRebatePts[i].x, backRebatePts[i].y);
    addQuad(backOuterPts[next], backOuterPts[i], backRebatePts[i], backRebatePts[next], uvB, uvA, uvD, uvC);
  }

  // 2. Rebate inner wall
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(backRebatePts[i], backRebatePts[next], rebShelfPts[next], rebShelfPts[i],
      [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  }

  // 3. Rebate shelf (facing -Z)
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const uvA = getPlanarUV(rebShelfPts[i].x, rebShelfPts[i].y);
    const uvB = getPlanarUV(rebShelfPts[next].x, rebShelfPts[next].y);
    const uvC = getPlanarUV(winTunnelPts[next].x, winTunnelPts[next].y);
    const uvD = getPlanarUV(winTunnelPts[i].x, winTunnelPts[i].y);
    addQuad(rebShelfPts[next], rebShelfPts[i], winTunnelPts[i], winTunnelPts[next], uvB, uvA, uvD, uvC);
  }

  // 4. Inner window tunnel
  const frontWinPts = frontRings[0];
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(winTunnelPts[i], winTunnelPts[next], frontWinPts[next], frontWinPts[i],
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
      addQuad(ringA[i], ringA[next], ringB[next], ringB[i], uvA, uvB, uvC, uvD);
    }
  }

  // 6. Outer perimeter wall
  const frontOuterPts = frontRings[numProfileRings - 1];
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    const u0 = i / numPoints, u1 = (i + 1) / numPoints;
    addQuad(frontOuterPts[i], frontOuterPts[next], backOuterPts[next], backOuterPts[i],
      [u0, 1], [u1, 1], [u1, 0], [u0, 0]);
  }

  // 7. Optional Integrated Kickstand
  if (kickstand) {
    const legThick = 4.0;
    const legDepth = Math.max(28, outH * 0.42);
    const legW = Math.min(18, borderWidth * 0.7);
    const tiltRad = (15 * Math.PI) / 180;
    const legBaseZ = -legDepth * Math.sin(tiltRad);
    const legBaseY = -outH * 0.35 - legDepth * Math.cos(tiltRad);

    const legXOffsets = [-outW * 0.26, outW * 0.26];
    for (const lx of legXOffsets) {
      const p1 = new THREE.Vector3(lx - legW / 2, -outH * 0.1, 0);
      const p2 = new THREE.Vector3(lx + legW / 2, -outH * 0.1, 0);
      const p3 = new THREE.Vector3(lx + legW / 2, legBaseY, legBaseZ);
      const p4 = new THREE.Vector3(lx - legW / 2, legBaseY, legBaseZ);
      const p1b = new THREE.Vector3(lx - legW / 2, -outH * 0.1, legThick);
      const p2b = new THREE.Vector3(lx + legW / 2, -outH * 0.1, legThick);
      const p3b = new THREE.Vector3(lx + legW / 2, legBaseY, legBaseZ + legThick);
      const p4b = new THREE.Vector3(lx - legW / 2, legBaseY, legBaseZ + legThick);

      addQuad(p1, p2, p3, p4, [0,0], [1,0], [1,1], [0,1]);
      addQuad(p4b, p3b, p2b, p1b, [0,0], [1,0], [1,1], [0,1]);
      addQuad(p1, p4, p4b, p1b, [0,0], [1,0], [1,1], [0,1]);
      addQuad(p2b, p3b, p3, p2, [0,0], [1,0], [1,1], [0,1]);
      addQuad(p3, p3b, p4b, p4, [0,0], [1,0], [1,1], [0,1]);
    }
  }

  // 8. Optional Wall Mount Keyhole Slot / Tab
  if (wallMount) {
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

    addQuad(p4b, p3b, p2b, p1b, [0,0], [1,0], [1,1], [0,1]);
    addQuad(p1b, p2b, p2, p1, [0,0], [1,0], [1,1], [0,1]);
    addQuad(p3b, p4b, p4, p3, [0,0], [1,0], [1,1], [0,1]);
    addQuad(p4, p4b, p1b, p1, [0,0], [1,0], [1,1], [0,1]);
    addQuad(p2, p2b, p3b, p3, [0,0], [1,0], [1,1], [0,1]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  geometry.userData = {
    generator: 'frame',
    name: `marco_${shape}_${photoW}x${photoH}`,
    dimensions: {
      width: Math.round(outW * 10) / 10,
      height: Math.round(outH * 10) / 10,
      depth: Math.round(frameDepth * 10) / 10
    },
    photoDimensions: { width: photoW, height: photoH },
    triangles: positions.length / 9
  };

  return geometry;
}
