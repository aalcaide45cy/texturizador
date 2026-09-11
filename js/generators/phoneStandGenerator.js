/* Texturizador - Phone Stand Generator */

import * as THREE from 'three';

export const PHONE_PRESETS = {
  'compact': {
    name: 'Compacto Escritorio',
    width: 65,
    angle: 60,
    slotDepth: 14,
    lipHeight: 14,
    baseDepth: 72,
    height: 75,
    cablePass: false
  },
  'charging': {
    name: 'Base de Carga con Ranura Cable',
    width: 70,
    angle: 65,
    slotDepth: 15,
    lipHeight: 16,
    baseDepth: 80,
    height: 85,
    cablePass: true
  },
  'dual-angle': {
    name: 'Doble Inclinación (45° y 70°)',
    width: 68,
    angle: 45,
    slotDepth: 14,
    lipHeight: 15,
    baseDepth: 85,
    height: 80,
    cablePass: false,
    isDualAngle: true
  },
  'wave': {
    name: 'Orgánico Curvo (Wave)',
    width: 65,
    angle: 60,
    slotDepth: 14,
    lipHeight: 15,
    baseDepth: 78,
    height: 78,
    cablePass: false,
    isWave: true
  },
  'tablet': {
    name: 'Soporte Tablet / iPad',
    width: 110,
    angle: 62,
    slotDepth: 20,
    lipHeight: 20,
    baseDepth: 105,
    height: 110,
    cablePass: true
  }
};

/**
 * Generate a complete, watertight 3D phone stand.
 */
export function generatePhoneStand(params = {}) {
  const presetKey = params.preset || 'compact';
  const preset = PHONE_PRESETS[presetKey] || PHONE_PRESETS.compact;

  const width = Math.max(40, Math.min(160, Number(params.width) || preset.width));
  const angleDeg = Math.max(35, Math.min(80, Number(params.angle) || preset.angle));
  const slotDepth = Math.max(10, Math.min(26, Number(params.slotDepth) || preset.slotDepth));
  const lipHeight = Math.max(8, Math.min(28, Number(params.lipHeight) || preset.lipHeight));
  const cablePass = params.cablePass !== undefined ? Boolean(params.cablePass) : preset.cablePass;
  const isDualAngle = preset.isDualAngle;
  const isWave = preset.isWave;

  const angleRad = (angleDeg * Math.PI) / 180;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);

  // Overall dimensions
  const totalH = Math.max(65, Number(params.height) || preset.height);
  const baseL = Math.max(60, Number(params.baseDepth) || preset.baseDepth);
  const wallT = 6.0; // Structural thickness

  // Build side cross-section 2D points (Y = height, X = depth front-to-back)
  // Base rests on Y = 0
  const profile = [];

  if (isDualAngle) {
    // Reversible dual angle profile with 2 slots
    const a1 = (45 * Math.PI) / 180;
    const a2 = (70 * Math.PI) / 180;
    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(baseL, 0));
    profile.push(new THREE.Vector2(baseL, 16));
    profile.push(new THREE.Vector2(baseL - 14 * Math.cos(a2), 16 + 14 * Math.sin(a2)));
    profile.push(new THREE.Vector2(baseL - 14 * Math.cos(a2) - wallT, 16 + 14 * Math.sin(a2)));
    profile.push(new THREE.Vector2(baseL * 0.45, totalH));
    profile.push(new THREE.Vector2(baseL * 0.38, totalH));
    profile.push(new THREE.Vector2(14 * Math.cos(a1) + wallT, 16 + 14 * Math.sin(a1)));
    profile.push(new THREE.Vector2(14 * Math.cos(a1), 16 + 14 * Math.sin(a1)));
    profile.push(new THREE.Vector2(0, 16));
  } else if (isWave) {
    // Smooth ergonomic S-curve profile
    const numWavePts = 24;
    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(baseL, 0));
    profile.push(new THREE.Vector2(baseL - 4, wallT));
    // Up the back spine
    for (let i = 0; i <= numWavePts; i++) {
      const t = i / numWavePts;
      const py = wallT + (totalH - wallT) * t;
      const waveOffset = Math.sin(t * Math.PI) * 10;
      const px = baseL - 4 - (baseL * 0.65) * t + waveOffset;
      profile.push(new THREE.Vector2(px, py));
    }
    // Front cradle curve
    const cradleTopX = profile[profile.length - 1].x - wallT;
    profile.push(new THREE.Vector2(cradleTopX, totalH));
    const cradleX = 14 + slotDepth * cosA;
    const cradleY = 12 + slotDepth * sinA;
    profile.push(new THREE.Vector2(cradleX, cradleY));
    profile.push(new THREE.Vector2(14, 12));
    profile.push(new THREE.Vector2(14 - lipHeight * sinA, 12 + lipHeight * cosA));
    profile.push(new THREE.Vector2(4, 10));
    profile.push(new THREE.Vector2(0, 4));
  } else {
    // Standard and Charging dock profile
    const shelfElev = cablePass ? 24 : 10;
    const lipX = 6;
    const lipY = shelfElev + lipHeight;
    const slotX = lipX + slotDepth * cosA;
    const slotY = shelfElev - slotDepth * sinA * 0.2;
    const backTopX = slotX + (totalH - shelfElev) * (cosA / sinA);
    const backTopY = totalH;

    profile.push(new THREE.Vector2(0, 0));          // Bottom-front origin
    profile.push(new THREE.Vector2(baseL, 0));      // Bottom-back edge
    profile.push(new THREE.Vector2(baseL, 8));      // Rear foot rise
    profile.push(new THREE.Vector2(backTopX + wallT * 0.8, backTopY)); // Top-rear
    profile.push(new THREE.Vector2(backTopX, backTopY));               // Top-front back support
    profile.push(new THREE.Vector2(slotX, slotY));                     // Base of phone slot
    profile.push(new THREE.Vector2(lipX + wallT * 0.4, shelfElev));    // Front lip inside
    profile.push(new THREE.Vector2(lipX, lipY));                       // Front lip top tip
    profile.push(new THREE.Vector2(2, shelfElev * 0.7));               // Front face curve
    profile.push(new THREE.Vector2(0, 4));                             // Front toe
  }

  // Cable slot parameters
  const cableWidth = 20; // 20mm slot in center
  const hasCableSlot = cablePass && width > (cableWidth + 16);

  // Width sections: if cable slot, build 3 segments (left solid, center notched, right solid)
  // Otherwise extrude profile smoothly across width
  const positions = [];
  const uvs = [];

  function addQuad(p1, p2, p3, p4) {
    positions.push(p1.x, p1.y, p1.z);
    positions.push(p2.x, p2.y, p2.z);
    positions.push(p3.x, p3.y, p3.z);

    positions.push(p1.x, p1.y, p1.z);
    positions.push(p3.x, p3.y, p3.z);
    positions.push(p4.x, p4.y, p4.z);

    uvs.push(0, 0, 1, 0, 1, 1);
    uvs.push(0, 0, 1, 1, 0, 1);
  }

  // Cross section triangulation (Ear clipping / triangle fan for simple convex/star-like polygon)
  function triangulateFace(pts2D, z, facingPositive) {
    // Triangle fan from centroid
    let cx = 0, cy = 0;
    for (const p of pts2D) { cx += p.x; cy += p.y; }
    cx /= pts2D.length;
    cy /= pts2D.length;
    const center = new THREE.Vector3(cx, cy, z);

    for (let i = 0; i < pts2D.length; i++) {
      const next = (i + 1) % pts2D.length;
      const v1 = new THREE.Vector3(pts2D[i].x, pts2D[i].y, z);
      const v2 = new THREE.Vector3(pts2D[next].x, pts2D[next].y, z);
      if (facingPositive) {
        positions.push(center.x, center.y, center.z);
        positions.push(v1.x, v1.y, v1.z);
        positions.push(v2.x, v2.y, v2.z);
      } else {
        positions.push(center.x, center.y, center.z);
        positions.push(v2.x, v2.y, v2.z);
        positions.push(v1.x, v1.y, v1.z);
      }
      uvs.push(0.5, 0.5, 0, 0, 1, 0);
    }
  }

  const halfW = width / 2;

  if (!hasCableSlot) {
    // Clean continuous extrusion from Z = -halfW to Z = +halfW
    const z0 = -halfW, z1 = halfW;
    const N = profile.length;

    // Side caps
    triangulateFace(profile, z0, false);
    triangulateFace(profile, z1, true);

    // Perimeter walls connecting the two side caps
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const p0A = new THREE.Vector3(profile[i].x, profile[i].y, z0);
      const p0B = new THREE.Vector3(profile[next].x, profile[next].y, z0);
      const p1B = new THREE.Vector3(profile[next].x, profile[next].y, z1);
      const p1A = new THREE.Vector3(profile[i].x, profile[i].y, z1);
      addQuad(p0A, p1A, p1B, p0B);
    }
  } else {
    // 3 sections: Left wing [-halfW, -cableWidth/2], Center slot [-cableWidth/2, +cableWidth/2], Right wing [+cableWidth/2, +halfW]
    const zLeft0 = -halfW;
    const zLeft1 = -cableWidth / 2;
    const zRight0 = cableWidth / 2;
    const zRight1 = halfW;

    // Notched center profile (lowers the front lip and cradle floor to create cable pass-through channel)
    const centerProfile = profile.map(pt => {
      // Lower front lip and cradle shelf
      if (pt.x < baseL * 0.45 && pt.y < totalH * 0.5) {
        return new THREE.Vector2(pt.x, Math.max(6, pt.y - 15));
      }
      return pt.clone();
    });

    const N = profile.length;

    // Left Wing
    triangulateFace(profile, zLeft0, false);
    triangulateFace(profile, zLeft1, true);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addQuad(
        new THREE.Vector3(profile[i].x, profile[i].y, zLeft0),
        new THREE.Vector3(profile[i].x, profile[i].y, zLeft1),
        new THREE.Vector3(profile[next].x, profile[next].y, zLeft1),
        new THREE.Vector3(profile[next].x, profile[next].y, zLeft0)
      );
    }

    // Right Wing
    triangulateFace(profile, zRight0, false);
    triangulateFace(profile, zRight1, true);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addQuad(
        new THREE.Vector3(profile[i].x, profile[i].y, zRight0),
        new THREE.Vector3(profile[i].x, profile[i].y, zRight1),
        new THREE.Vector3(profile[next].x, profile[next].y, zRight1),
        new THREE.Vector3(profile[next].x, profile[next].y, zRight0)
      );
    }

    // Center Notched Channel
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addQuad(
        new THREE.Vector3(centerProfile[i].x, centerProfile[i].y, zLeft1),
        new THREE.Vector3(centerProfile[i].x, centerProfile[i].y, zRight0),
        new THREE.Vector3(centerProfile[next].x, centerProfile[next].y, zRight0),
        new THREE.Vector3(centerProfile[next].x, centerProfile[next].y, zLeft1)
      );
    }
  }

  // Center model horizontally (X along depth, Y along height, Z along width)
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // Center X and Z so origin is at center of base
  geom.center();
  // Adjust so base rests at Y = 0
  geom.computeBoundingBox();
  const minY = geom.boundingBox.min.y;
  geom.translate(0, -minY, 0);
  geom.computeVertexNormals();

  geom.userData = {
    generator: 'phone',
    name: `soporte_movil_${presetKey}`,
    dimensions: {
      width: Math.round(width * 10) / 10,
      depth: Math.round(baseL * 10) / 10,
      height: Math.round(totalH * 10) / 10
    },
    triangles: positions.length / 9
  };

  return geom;
}
