/* Texturizador - Smart Fit (Ajuste Perfecto Inteligente) */

import { computeSmartResolution } from './smartResolution.js';

export const SHAPE_CYLINDER = 'cylinder';
export const SHAPE_BOX      = 'box';
export const SHAPE_PLANAR   = 'planar';
export const SHAPE_SPHERE   = 'sphere';
export const SHAPE_ORGANIC  = 'organic';

/**
 * Analyze a 3D geometry to determine its predominant shape and symmetry.
 * @param {THREE.BufferGeometry} geometry
 * @param {{ min: THREE.Vector3, max: THREE.Vector3, size: THREE.Vector3, center: THREE.Vector3 }} bounds
 * @param {Float32Array|null} faceNormals
 * @returns {Object} Shape analysis info
 */
export function analyzeGeometryShape(geometry, bounds, faceNormals) {
  if (!geometry || !bounds) return { type: SHAPE_ORGANIC };

  const pos = geometry.attributes.position.array;
  const idx = geometry.index ? geometry.index.array : null;
  const triCount = idx ? (idx.length / 3) : (pos.length / 9);
  const { size, center } = bounds;

  // 1. Check for planar / thin plate relief
  const minDim = Math.min(size.x, size.y, size.z);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (size.z / Math.max(size.x, size.y, 1e-4) < 0.18) {
    let zCapArea = 0;
    let totalSampled = 0;
    const step = Math.max(1, Math.floor(triCount / 1000));
    for (let t = 0; t < triCount; t += step) {
      const nz = faceNormals ? faceNormals[t * 3 + 2] : 0;
      if (Math.abs(nz) > 0.85) zCapArea++;
      totalSampled++;
    }
    if (totalSampled > 0 && (zCapArea / totalSampled) > 0.55) {
      return {
        type: SHAPE_PLANAR,
        axis: 'Z',
        thickness: size.z,
      };
    }
  }

  // 2. Test Cylindrical symmetry around Z axis
  // Fit circle to outward-facing wall vertices (|n.z| < 0.45)
  let n = 0;
  let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
  let Sxz = 0, Syz = 0, Sz = 0;
  const step = Math.max(1, Math.floor(triCount / 4000));
  const wallVerts = [];
  const wallDirSet = new Set();

  for (let t = 0; t < triCount; t += step) {
    const nz = faceNormals ? faceNormals[t * 3 + 2] : 0;
    if (Math.abs(nz) >= 0.45) continue; // skip top and bottom caps

    if (faceNormals) {
      const nx = faceNormals[t * 3];
      const ny = faceNormals[t * 3 + 1];
      const bucket = Math.round(Math.atan2(ny, nx) * (18 / Math.PI)); // ~10 deg buckets
      wallDirSet.add(bucket);
    }

    for (let v = 0; v < 3; v++) {
      const i = idx ? idx[t * 3 + v] : (t * 3 + v);
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = x * x + y * y;
      Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y;
      Sxz += x * z; Syz += y * z; Sz += z;
      n++;
      if (wallVerts.length < 1500) {
        wallVerts.push({ x, y });
      }
    }
  }

  // A cylinder must have walls curving smoothly around 360 deg (at least 8 distinct angle sectors,
  // whereas a box has only 4 wall normal directions).
  const hasCurvedWalls = !faceNormals || wallDirSet.size >= 8;

  if (n >= 15 && hasCurvedWalls) {
    // Solve Kasa least-squares circle fit:
    const M = [
      [Sxx, Sxy, Sx],
      [Sxy, Syy, Sy],
      [Sx,  Sy,  n ],
    ];
    const bVec = [Sxz, Syz, Sz];
    const det = (m) =>
        m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
      - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
      + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
    const D = det(M);

    if (Math.abs(D) > 1e-10) {
      const colReplace = (col) => M.map((row, i) => row.map((val, j) => j === col ? bVec[i] : val));
      const A = det(colReplace(0)) / D;
      const B = det(colReplace(1)) / D;
      const C = det(colReplace(2)) / D;
      const cx = A / 2;
      const cy = B / 2;
      const r2 = C + cx * cx + cy * cy;

      if (Number.isFinite(r2) && r2 > 0) {
        const r = Math.sqrt(r2);
        // For a real cylinder oriented along Z, the diameter 2*r matches the X/Y bbox extent
        const diamDiffX = Math.abs(2 * r - size.x) / size.x;
        const diamDiffY = Math.abs(2 * r - size.y) / size.y;
        const maxReasonable = Math.max(size.x, size.y) * 1.5;

        if (r <= maxReasonable && r >= 0.5 && diamDiffX < 0.08 && diamDiffY < 0.08) {
          // Check circular residual quality: what fraction of vertices lie near radius r?
          let closeCount = 0;
          let totalDev = 0;
          for (const p of wallVerts) {
            const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
            const dev = Math.abs(dist - r) / r;
            totalDev += dev;
            if (dev < 0.10) closeCount++;
          }

          const avgDev = wallVerts.length > 0 ? (totalDev / wallVerts.length) : 1;
          const fitRatio = wallVerts.length > 0 ? (closeCount / wallVerts.length) : 0;
          const xyAspect = Math.min(size.x, size.y) / Math.max(size.x, size.y, 1e-4);

          // If fit ratio is high or average deviation is small and XY aspect is close to 1:
          if ((fitRatio >= 0.55 || avgDev < 0.08) && xyAspect > 0.80) {
            return {
              type: SHAPE_CYLINDER,
              cx,
              cy,
              radius: r,
              height: size.z,
              fitRatio,
              avgDev,
            };
          }
        }
      }
    }
  }

  // 3. Test for Spherical geometry
  const maxCenterDev = Math.max(
    Math.abs(size.x - size.y),
    Math.abs(size.y - size.z),
    Math.abs(size.x - size.z)
  ) / maxDim;

  if (maxCenterDev < 0.15) {
    const meanR = (size.x + size.y + size.z) / 6;
    let sphereClose = 0;
    let sampleTotal = 0;
    const vStep = Math.max(1, Math.floor((pos.length / 3) / 1000));
    for (let i = 0; i < pos.length; i += vStep * 3) {
      const dx = pos[i] - center.x;
      const dy = pos[i + 1] - center.y;
      const dz = pos[i + 2] - center.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (Math.abs(d - meanR) / meanR < 0.12) sphereClose++;
      sampleTotal++;
    }
    if (sampleTotal > 0 && (sphereClose / sampleTotal) > 0.70) {
      return {
        type: SHAPE_SPHERE,
        radius: meanR,
      };
    }
  }

  // 4. Test for Box / Prismatic / Mechanical geometry
  if (faceNormals) {
    let axisAlignedCount = 0;
    let normalSamples = 0;
    const nStep = Math.max(1, Math.floor(triCount / 1000));
    for (let t = 0; t < triCount; t += nStep) {
      const nx = Math.abs(faceNormals[t * 3]);
      const ny = Math.abs(faceNormals[t * 3 + 1]);
      const nz = Math.abs(faceNormals[t * 3 + 2]);
      const primary = Math.max(nx, ny, nz);
      if (primary > 0.88) axisAlignedCount++;
      normalSamples++;
    }
    if (normalSamples > 0 && (axisAlignedCount / normalSamples) > 0.55) {
      return {
        type: SHAPE_BOX,
        boxiness: axisAlignedCount / normalSamples,
      };
    }
  }

  return {
    type: SHAPE_ORGANIC,
    maxDim,
    minDim,
  };
}

/**
 * Execute the 1-Click Smart Fit algorithm.
 * Analyzes the model and texture, tunes mapping mode, seamless wrap, scale,
 * depth, and resolution for optimal visual definition.
 *
 * @param {Object} ctx
 * @param {THREE.BufferGeometry} ctx.geometry
 * @param {Object} ctx.bounds
 * @param {Object} ctx.settings
 * @param {Object} ctx.texture
 * @param {Float32Array|null} ctx.faceNormals
 * @returns {Object} Result summary describing what was adjusted
 */
export function applySmartFit({ geometry, bounds, settings, texture, faceNormals }) {
  if (!geometry || !bounds) {
    return { success: false, reason: 'no_geometry' };
  }

  const { size, center } = bounds;
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
  const minDim = Math.min(size.x, size.y, size.z);

  // 1. Analyze shape
  const shape = analyzeGeometryShape(geometry, bounds, faceNormals);

  // 2. Configure Mapping & Seamless Tiling based on shape
  let mappingMode = 5; // Default Triplanar
  let scaleMm = 25;
  let repeats = 1;
  let circumference = 0;
  let capTreatment = 'smooth';

  if (shape.type === SHAPE_CYLINDER) {
    mappingMode = 3; // Cylindrical
    const r = shape.radius;
    circumference = 2 * Math.PI * r;

    // Determine optimal pattern tile size.
    // For visual harmony, tile size is typically ~12mm to ~30mm,
    // or about 1/4 to 1/8 of the circumference.
    const targetTile = Math.max(10, Math.min(32, circumference / 6));
    repeats = Math.max(1, Math.round(circumference / targetTile));

    // Exact integer division guarantees 100% seamless wrap!
    scaleMm = circumference / repeats;

    settings.mappingMode        = 3;
    settings.cylinderCenterX    = shape.cx;
    settings.cylinderCenterY    = shape.cy;
    settings.cylinderRadius     = r;
    settings.snapSeamlessWrap   = true;
    settings.cylinderCapMode    = 'smooth';
    settings.capAngle           = 25;
    settings.lockScale          = true;
    settings.scaleU             = scaleMm;
    settings.scaleV             = scaleMm;
    capTreatment                = 'smooth';

  } else if (shape.type === SHAPE_PLANAR) {
    mappingMode = 0; // Planar XY
    const majorFace = Math.max(size.x, size.y);
    // 3 to 6 repeats across the major face
    repeats = Math.max(2, Math.round(majorFace / 20));
    scaleMm = majorFace / repeats;

    settings.mappingMode        = 0;
    settings.lockScale          = true;
    settings.scaleU             = scaleMm;
    settings.scaleV             = scaleMm;

  } else if (shape.type === SHAPE_SPHERE) {
    mappingMode = 4; // Spherical
    const r = shape.radius;
    circumference = 2 * Math.PI * r;
    repeats = Math.max(2, Math.round(circumference / 22));
    scaleMm = circumference / repeats;

    settings.mappingMode        = 4;
    settings.snapSeamlessWrap   = true;
    settings.lockScale          = true;
    settings.scaleU             = scaleMm;
    settings.scaleV             = scaleMm;

  } else if (shape.type === SHAPE_BOX) {
    mappingMode = 5; // Triplanar
    const faceDim = (size.x + size.y + size.z) / 3;
    repeats = Math.max(2, Math.round(faceDim / 20));
    scaleMm = faceDim / repeats;

    settings.mappingMode          = 5;
    settings.mappingBlend         = 1.0;
    settings.seamBandWidth        = 0.5;
    settings.blendNormalSmoothing = 32;
    settings.lockScale            = true;
    settings.scaleU               = scaleMm;
    settings.scaleV               = scaleMm;

  } else {
    // Organic / complex shape
    mappingMode = 5; // Triplanar is best for general organic 3D shapes
    scaleMm = Math.max(12, Math.min(40, maxDim / 5));

    settings.mappingMode          = 5;
    settings.mappingBlend         = 1.0;
    settings.seamBandWidth        = 0.5;
    settings.blendNormalSmoothing = 32;
    settings.lockScale            = true;
    settings.scaleU               = scaleMm;
    settings.scaleV               = scaleMm;
  }

  // 3. Calibrate Texture Depth (Height in mm) for optimal tactile definition
  // Depth between 1.5% and 3.5% of min dimension, clamped between 0.45mm and 1.25mm
  const targetDepth = Math.max(0.45, Math.min(1.25, minDim * 0.025));
  const roundedDepth = Math.round(targetDepth * 20) / 20; // round to nearest 0.05
  settings.textureHeight = roundedDepth;
  settings.amplitude = (settings.invertDisplacement ? -1 : 1) * roundedDepth;

  // 4. Optimize Mesh Resolution & Triangles (Smart Resolution)
  let resEdge = settings.refineLength ?? 1.0;
  let maxTris = settings.maxTriangles ?? 750000;
  if (texture && texture.imageData) {
    try {
      const resResult = computeSmartResolution({
        geometry,
        bounds,
        settings,
        texture,
      });
      if (resResult) {
        resEdge = Number(resResult.edge.toFixed(2));
        maxTris = resResult.diagnostics.recommendedMaxTri;
        settings.refineLength = resEdge;
        settings.maxTriangles = maxTris;
      }
    } catch (e) {
      console.warn('Smart resolution inside Smart Fit skipped:', e);
    }
  }

  // 5. Printing Base Protection
  settings.smoothBottom      = true;
  settings.bottomAngleLimit  = 5;
  settings.harvestFlatFaces  = true;
  settings.harvestTol        = 0.005;

  return {
    success: true,
    shapeType: shape.type,
    shapeDetails: shape,
    mappingMode,
    scaleMm: Number(scaleMm.toFixed(2)),
    repeats,
    circumference: Number(circumference.toFixed(1)),
    textureHeight: roundedDepth,
    refineLength: resEdge,
    maxTriangles: maxTris,
    capTreatment,
  };
}
