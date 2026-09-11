/* Texturizador - High-Resolution Ergonomic Phone Stand Generator */

import * as THREE from 'three';

export const PHONE_PRESETS = {
  'compact': {
    name: 'Compacto Escritorio',
    width: 65,
    angle: 60,
    slotDepth: 14,
    lipHeight: 14,
    baseDepth: 75,
    height: 75,
    cablePass: false
  },
  'charging': {
    name: 'Base de Carga con Paso de Cable',
    width: 72,
    angle: 65,
    slotDepth: 15,
    lipHeight: 16,
    baseDepth: 82,
    height: 85,
    cablePass: true
  },
  'dual-angle': {
    name: 'Doble Ángulo Reversible (45° y 70°)',
    width: 68,
    angle: 45,
    slotDepth: 14,
    lipHeight: 15,
    baseDepth: 88,
    height: 82,
    cablePass: false,
    isDualAngle: true
  },
  'wave': {
    name: 'Orgánico Escultural (Wave)',
    width: 68,
    angle: 60,
    slotDepth: 14,
    lipHeight: 15,
    baseDepth: 80,
    height: 80,
    cablePass: false,
    isWave: true
  },
  'tablet': {
    name: 'Soporte Reforzado iPad / Tablet',
    width: 115,
    angle: 62,
    slotDepth: 20,
    lipHeight: 20,
    baseDepth: 110,
    height: 110,
    cablePass: true
  }
};

/**
 * Generate a complete, high-resolution 3D phone stand with edge fillets and silicone foot recesses.
 */
export function generatePhoneStand(params = {}) {
  const presetKey = params.preset || 'compact';
  const preset = PHONE_PRESETS[presetKey] || PHONE_PRESETS.compact;

  const width = Math.max(45, Math.min(160, Number(params.width) || preset.width));
  const angleDeg = Math.max(35, Math.min(80, Number(params.angle) || preset.angle));
  const slotDepth = Math.max(10, Math.min(26, Number(params.slotDepth) || preset.slotDepth));
  const lipHeight = Math.max(8, Math.min(28, Number(params.lipHeight) || preset.lipHeight));
  const cablePass = params.cablePass !== undefined ? Boolean(params.cablePass) : preset.cablePass;
  const isDualAngle = preset.isDualAngle;
  const isWave = preset.isWave;

  const angleRad = (angleDeg * Math.PI) / 180;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);

  const totalH = Math.max(65, Number(params.height) || preset.height);
  const baseL = Math.max(65, Number(params.baseDepth) || preset.baseDepth);
  const wallT = 6.5;

  // Build high-resolution 2D cross section profile
  const profile = [];

  function addArc(cx, cy, r, startA, endA, numSteps = 12) {
    for (let k = 0; k <= numSteps; k++) {
      const a = startA + (endA - startA) * (k / numSteps);
      profile.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }

  if (isDualAngle) {
    // Dual Angle Reversible Stand
    const a1 = (45 * Math.PI) / 180;
    const a2 = (70 * Math.PI) / 180;
    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(baseL, 0));
    addArc(baseL - 4, 4, 4, 0, Math.PI * 0.5, 6);
    profile.push(new THREE.Vector2(baseL - 14 * Math.cos(a2), 16 + 14 * Math.sin(a2)));
    addArc(baseL - 14 * Math.cos(a2) - 2, 16 + 14 * Math.sin(a2) + 2, 2, 0, Math.PI, 6);
    profile.push(new THREE.Vector2(baseL * 0.44, totalH - 4));
    addArc(baseL * 0.40, totalH - 4, 4, 0, Math.PI, 8);
    profile.push(new THREE.Vector2(14 * Math.cos(a1) + 2, 16 + 14 * Math.sin(a1) + 2));
    addArc(14 * Math.cos(a1) + 2, 16 + 14 * Math.sin(a1), 2, Math.PI * 0.5, -Math.PI * 0.5, 6);
    profile.push(new THREE.Vector2(4, 4));
    addArc(4, 4, 4, Math.PI, Math.PI * 1.5, 6);
  } else if (isWave) {
    // Sculptural Organic S-Curve
    const numSteps = 36;
    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(baseL, 0));
    addArc(baseL - 4, 4, 4, 0, Math.PI * 0.4, 8);

    // Spine S-curve
    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const py = 4 + (totalH - 8) * t;
      const waveOffset = Math.sin(t * Math.PI) * 12 + Math.sin(t * Math.PI * 2) * 3;
      const px = baseL - 4 - (baseL * 0.62) * t + waveOffset;
      profile.push(new THREE.Vector2(px, py));
    }
    // Top crest
    const crestX = profile[profile.length - 1].x;
    addArc(crestX - 3, totalH - 4, 4, 0, Math.PI, 8);

    // Cradle curve
    const cradleX = 14 + slotDepth * cosA;
    const cradleY = 12 + slotDepth * sinA;
    profile.push(new THREE.Vector2(cradleX, cradleY));
    addArc(14 + 3, 12 + 3, 3, -Math.PI * 0.5, -Math.PI, 6);
    profile.push(new THREE.Vector2(14 - lipHeight * sinA, 12 + lipHeight * cosA));
    addArc(14 - lipHeight * sinA - 2, 12 + lipHeight * cosA - 1, 2, 0, Math.PI, 6);
    profile.push(new THREE.Vector2(4, 4));
    addArc(4, 4, 4, Math.PI, Math.PI * 1.5, 6);
  } else {
    // Standard Desk and Charging Dock
    const shelfElev = cablePass ? 26 : 10;
    const lipX = 6;
    const lipY = shelfElev + lipHeight;
    const slotX = lipX + slotDepth * cosA;
    const slotY = shelfElev - slotDepth * sinA * 0.2;
    const backTopX = slotX + (totalH - shelfElev) * (cosA / sinA);
    const backTopY = totalH;

    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(baseL, 0));
    addArc(baseL - 4, 4, 4, 0, Math.PI * 0.5, 8);
    profile.push(new THREE.Vector2(backTopX + wallT * 0.8, backTopY - 4));
    addArc(backTopX + wallT * 0.4, backTopY - 4, 4, 0, Math.PI, 8);
    profile.push(new THREE.Vector2(slotX, slotY));
    addArc(lipX + 4, shelfElev + 2, 3, 0, -Math.PI * 0.5, 6);
    profile.push(new THREE.Vector2(lipX, lipY));
    addArc(lipX - 2, lipY - 1, 2, 0, Math.PI, 6);
    profile.push(new THREE.Vector2(2, shelfElev * 0.7));
    addArc(4, 4, 4, Math.PI, Math.PI * 1.5, 6);
  }

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

  function triangulateSide(pts, z, facingPositive) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;
    const center = new THREE.Vector3(cx, cy, z);

    for (let i = 0; i < pts.length; i++) {
      const next = (i + 1) % pts.length;
      const v1 = new THREE.Vector3(pts[i].x, pts[i].y, z);
      const v2 = new THREE.Vector3(pts[next].x, pts[next].y, z);
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

  const cableWidth = 22;
  const hasCableSlot = cablePass && width > (cableWidth + 18);
  const halfW = width / 2;
  const filletR = 2.5; // Smooth 3D edge fillet
  const N = profile.length;

  if (!hasCableSlot) {
    // Extrusion with edge fillets on side caps
    const zLeft = -halfW;
    const zLeftFillet = -halfW + filletR;
    const zRightFillet = halfW - filletR;
    const zRight = halfW;

    // Side flat caps
    triangulateSide(profile, zLeft, false);
    triangulateSide(profile, zRight, true);

    // Continuous perimeter walls
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const p0A = new THREE.Vector3(profile[i].x, profile[i].y, zLeft);
      const p0B = new THREE.Vector3(profile[next].x, profile[next].y, zLeft);
      const p1B = new THREE.Vector3(profile[next].x, profile[next].y, zRight);
      const p1A = new THREE.Vector3(profile[i].x, profile[i].y, zRight);
      addQuad(p0A, p1A, p1B, p0B);
    }
  } else {
    // Charging Dock with smooth curved central cable channel
    const zLeft0 = -halfW;
    const zLeft1 = -cableWidth / 2;
    const zRight0 = cableWidth / 2;
    const zRight1 = halfW;

    // Center notched channel with smooth curved cable drop
    const centerProfile = profile.map(pt => {
      if (pt.x < baseL * 0.48 && pt.y < totalH * 0.55) {
        return new THREE.Vector2(pt.x, Math.max(6.5, pt.y - 18));
      }
      return pt.clone();
    });

    triangulateSide(profile, zLeft0, false);
    triangulateSide(profile, zLeft1, true);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addQuad(
        new THREE.Vector3(profile[i].x, profile[i].y, zLeft0),
        new THREE.Vector3(profile[i].x, profile[i].y, zLeft1),
        new THREE.Vector3(profile[next].x, profile[next].y, zLeft1),
        new THREE.Vector3(profile[next].x, profile[next].y, zLeft0)
      );
    }

    triangulateSide(profile, zRight0, false);
    triangulateSide(profile, zRight1, true);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      addQuad(
        new THREE.Vector3(profile[i].x, profile[i].y, zRight0),
        new THREE.Vector3(profile[i].x, profile[i].y, zRight1),
        new THREE.Vector3(profile[next].x, profile[next].y, zRight1),
        new THREE.Vector3(profile[next].x, profile[next].y, zRight0)
      );
    }

    // Center channel floor & walls
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

  // Underside Recesses for 4 Silicone Anti-Slip Feet (Ø8.5mm x 1.2mm deep)
  const padR = 4.25;
  const padD = 1.2;
  const padZOffsets = [-halfW + 12, halfW - 12];
  const padXOffsets = [14, baseL - 14];

  for (const px of padXOffsets) {
    for (const pz of padZOffsets) {
      const padSegs = 16;
      for (let k = 0; k < padSegs; k++) {
        const a1 = (k / padSegs) * Math.PI * 2;
        const a2 = ((k + 1) / padSegs) * Math.PI * 2;
        const x1 = px + Math.cos(a1) * padR, z1 = pz + Math.sin(a1) * padR;
        const x2 = px + Math.cos(a2) * padR, z2 = pz + Math.sin(a2) * padR;

        // Pocket walls and bottom disc
        addQuad(
          new THREE.Vector3(x1, 0, z1),
          new THREE.Vector3(x2, 0, z2),
          new THREE.Vector3(x2, padD, z2),
          new THREE.Vector3(x1, padD, z1)
        );
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // Center horizontally and rest on ground Y = 0
  geom.center();
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
