/* Texturizador */

import * as THREE from 'three';

const SIZE  = 512; // texture resolution for both preview and sampling
const THUMB = 80;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width  = w;
  c.height = h;
  return c;
}

/** Return { w, h } capped at SIZE on the longest side, preserving aspect ratio. */
function fitDimensions(imgW, imgH) {
  const scale = Math.min(SIZE / imgW, SIZE / imgH, 1);
  return { w: Math.round(imgW * scale), h: Math.round(imgH * scale) };
}

// ── Image-based presets (44 textures) ────────────────────────────────────────

const IMAGE_PRESETS = [
  // Originales
  { name: 'Cesta',            nameEn: 'Basket',           url: 'textures/basket.png',             thumb: 'textures/thumbs/basket.webp',             defaultScale: 0.5 },
  { name: 'Ladrillo',         nameEn: 'Brick',            url: 'textures/brick.png',              thumb: 'textures/thumbs/brick.webp',              defaultScale: 0.5 },
  { name: 'Burbujas',         nameEn: 'Bubble',           url: 'textures/bubble.png',             thumb: 'textures/thumbs/bubble.webp',             defaultScale: 0.5 },
  { name: 'Fibra Carbono',    nameEn: 'Carbon Fiber',     url: 'textures/carbonFiber.jpg',        thumb: 'textures/thumbs/carbonFiber.webp',        defaultScale: 0.5 },
  { name: 'Cristal',          nameEn: 'Crystal',          url: 'textures/crystal.png',            thumb: 'textures/thumbs/crystal.webp',            defaultScale: 0.5 },
  { name: 'Puntos',           nameEn: 'Dots',             url: 'textures/dots.png',               thumb: 'textures/thumbs/dots.webp',               defaultScale: 0.1 },
  { name: 'Cuadrícula',       nameEn: 'Grid',             url: 'textures/grid.png',               thumb: 'textures/thumbs/grid.webp',               defaultScale: 1.0 },
  { name: 'Superficie Agarre', nameEn: 'Grip Surface',    url: 'textures/gripSurface.jpg',        thumb: 'textures/thumbs/gripSurface.webp',        defaultScale: 0.5 },
  { name: 'Hexágono',         nameEn: 'Hexagon',          url: 'textures/hexagon.jpg',            thumb: 'textures/thumbs/hexagon.webp',            defaultScale: 0.5 },
  { name: 'Hexágonos',        nameEn: 'Hexagons',         url: 'textures/hexagons.jpg',           thumb: 'textures/thumbs/hexagons.webp',           defaultScale: 1.0 },
  { name: 'Isogrid',          nameEn: 'Isogrid',          url: 'textures/isogrid.png',            thumb: 'textures/thumbs/isogrid.webp',            defaultScale: 0.5 },
  { name: 'Tejido Punto',     nameEn: 'Knitting',         url: 'textures/knitting.png',           thumb: 'textures/thumbs/knitting.webp',           defaultScale: 0.25 },
  { name: 'Moleteado',        nameEn: 'Knurling',         url: 'textures/knurling.jpg',           thumb: 'textures/thumbs/knurling.webp',           defaultScale: 0.15 },
  { name: 'Cuero',            nameEn: 'Leather 2',        url: 'textures/leather2.png',           thumb: 'textures/thumbs/leather2.webp',           defaultScale: 0.5 },
  { name: 'Ruido',            nameEn: 'Noise',            url: 'textures/noise.jpg',              thumb: 'textures/thumbs/noise.webp',              defaultScale: 0.3 },
  { name: 'Rayas 1',          nameEn: 'Stripes 1',        url: 'textures/stripes.png',            thumb: 'textures/thumbs/stripes.webp',            defaultScale: 0.5 },
  { name: 'Rayas 2',          nameEn: 'Stripes 2',        url: 'textures/stripes_02.png',         thumb: 'textures/thumbs/stripes_02.webp',         defaultScale: 1.0 },
  { name: 'Voronoi',          nameEn: 'Voronoi',          url: 'textures/voronoi.jpg',            thumb: 'textures/thumbs/voronoi.webp',            defaultScale: 0.5 },
  { name: 'Entramado 1',      nameEn: 'Weave 1',          url: 'textures/weave.png',              thumb: 'textures/thumbs/weave.webp',              defaultScale: 0.5 },
  { name: 'Entramado 2',      nameEn: 'Weave 2',          url: 'textures/weave_02.jpg',           thumb: 'textures/thumbs/weave_02.webp',           defaultScale: 0.5 },
  { name: 'Entramado 3',      nameEn: 'Weave 3',          url: 'textures/weave_03.jpg',           thumb: 'textures/thumbs/weave_03.webp',           defaultScale: 0.5 },
  { name: 'Madera 1',         nameEn: 'Wood 1',           url: 'textures/wood.jpg',               thumb: 'textures/thumbs/wood.webp',               defaultScale: 0.5 },
  { name: 'Madera 2',         nameEn: 'Wood 2',           url: 'textures/woodgrain_02.jpg',       thumb: 'textures/thumbs/woodgrain_02.webp',       defaultScale: 1.0 },
  { name: 'Madera 3',         nameEn: 'Wood 3',           url: 'textures/woodgrain_03.jpg',       thumb: 'textures/thumbs/woodgrain_03.webp',       defaultScale: 1.0 },

  // Nuevas 20 texturas de alta calidad
  { name: 'Chapa Diamante',   nameEn: 'Diamond Plate',    url: 'textures/diamond_plate.png',      thumb: 'textures/thumbs/diamond_plate.webp',      defaultScale: 0.4 },
  { name: 'Escamas Dragón',   nameEn: 'Dragon Scales',    url: 'textures/dragon_scales.png',      thumb: 'textures/thumbs/dragon_scales.webp',      defaultScale: 0.35 },
  { name: 'Metal Martillado', nameEn: 'Hammered Metal',   url: 'textures/hammered_metal.png',     thumb: 'textures/thumbs/hammered_metal.webp',     defaultScale: 0.4 },
  { name: 'Panal Hexagonal',  nameEn: 'Honeycomb',        url: 'textures/honeycomb_hex.png',      thumb: 'textures/thumbs/honeycomb_hex.webp',      defaultScale: 0.5 },
  { name: 'Ondas Suaves',     nameEn: 'Soft Waves',       url: 'textures/soft_waves.png',         thumb: 'textures/thumbs/soft_waves.webp',         defaultScale: 0.5 },
  { name: 'Acanalado',        nameEn: 'Fluted Ribs',      url: 'textures/fluted_ribs.png',        thumb: 'textures/thumbs/fluted_ribs.webp',        defaultScale: 0.25 },
  { name: 'Piel Fina',        nameEn: 'Fine Leather',     url: 'textures/fine_leather.png',       thumb: 'textures/thumbs/fine_leather.webp',       defaultScale: 0.3 },
  { name: 'Topografía',       nameEn: 'Topographic',      url: 'textures/topographic_lines.png',  thumb: 'textures/thumbs/topographic_lines.webp',  defaultScale: 0.5 },
  { name: 'Cota de Malla',    nameEn: 'Chainmail',        url: 'textures/chainmail_rings.png',    thumb: 'textures/thumbs/chainmail_rings.webp',    defaultScale: 0.3 },
  { name: 'Prismas Facetados', nameEn: 'Triangle Facets', url: 'textures/triangle_facets.png',    thumb: 'textures/thumbs/triangle_facets.webp',    defaultScale: 0.4 },
  { name: 'Circuito PCB',     nameEn: 'Tech Circuit',     url: 'textures/tech_circuit.png',       thumb: 'textures/thumbs/tech_circuit.webp',       defaultScale: 0.4 },
  { name: 'Pirámides Tácticas', nameEn: 'Studded Grip',   url: 'textures/studded_pyramids.png',   thumb: 'textures/thumbs/studded_pyramids.webp',   defaultScale: 0.2 },
  { name: 'Espiga Chevron',   nameEn: 'Herringbone',      url: 'textures/herringbone_pattern.png', thumb: 'textures/thumbs/herringbone_pattern.webp', defaultScale: 0.35 },
  { name: 'Damero Biselado',  nameEn: 'Beveled Checker',  url: 'textures/beveled_checker.png',    thumb: 'textures/thumbs/beveled_checker.webp',    defaultScale: 0.4 },
  { name: 'Roca Volcánica',   nameEn: 'Lava Rock',        url: 'textures/lava_rock.png',          thumb: 'textures/thumbs/lava_rock.webp',          defaultScale: 0.4 },
  { name: 'Corteza Árbol',    nameEn: 'Tree Bark',        url: 'textures/tree_bark.png',          thumb: 'textures/thumbs/tree_bark.webp',          defaultScale: 0.5 },
  { name: 'Fibra Cruzada',    nameEn: 'Diamond Carbon',   url: 'textures/diamond_carbon.png',     thumb: 'textures/thumbs/diamond_carbon.webp',     defaultScale: 0.3 },
  { name: 'Rayos Radiales',   nameEn: 'Radial Sunburst',  url: 'textures/radial_sunburst.png',    thumb: 'textures/thumbs/radial_sunburst.webp',    defaultScale: 0.5 },
  { name: 'Punto de Cruz',    nameEn: 'Cross Stitch',     url: 'textures/cross_stitch.png',       thumb: 'textures/thumbs/cross_stitch.webp',       defaultScale: 0.25 },
  { name: 'Gotas de Agua',    nameEn: 'Water Droplets',   url: 'textures/water_droplets.png',     thumb: 'textures/thumbs/water_droplets.webp',     defaultScale: 0.4 },
];

// Cache for full-resolution preset data (keyed by index)
const _fullPresetCache = new Map();

/**
 * Load only the pre-computed thumbnail for a preset.
 * Returns { name, nameEn, thumbCanvas, defaultScale }.
 */
function loadPresetThumbnail(preset) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const thumb = makeCanvas(THUMB);
      thumb.getContext('2d').drawImage(img, 0, 0, THUMB, THUMB);
      resolve({ name: preset.name, nameEn: preset.nameEn, thumbCanvas: thumb, defaultScale: preset.defaultScale });
    };
    img.onerror = () => reject(new Error(`Failed to load thumbnail: ${preset.thumb}`));
    img.src = preset.thumb;
  });
}

/**
 * Load the full-resolution texture for a preset (on demand).
 * Returns the full entry: { name, nameEn, thumbCanvas, fullCanvas, texture, imageData, width, height, defaultScale }.
 */
export function loadFullPreset(idx) {
  if (_fullPresetCache.has(idx)) return Promise.resolve(_fullPresetCache.get(idx));
  const preset = IMAGE_PRESETS[idx];
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { w, h } = fitDimensions(img.width, img.height);
      const full = makeCanvas(w, h);
      full.getContext('2d').drawImage(img, 0, 0, w, h);

      const imageData = full.getContext('2d').getImageData(0, 0, w, h);
      const texture   = new THREE.CanvasTexture(full);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.name = preset.name;

      const entry = { name: preset.name, nameEn: preset.nameEn, fullCanvas: full, texture, imageData, width: w, height: h, defaultScale: preset.defaultScale };
      _fullPresetCache.set(idx, entry);
      resolve(entry);
    };
    img.onerror = () => reject(new Error(`Failed to load preset image: ${preset.url}`));
    img.src = preset.url;
  });
}

/**
 * Load all thumbnails. Returns Promise<Array<{ name, nameEn, thumbCanvas, defaultScale }|null>>.
 */
export function loadAllThumbnails() {
  return Promise.all(IMAGE_PRESETS.map(p =>
    loadPresetThumbnail(p).catch(() => null)
  ));
}

export { IMAGE_PRESETS };

/**
 * Build a THREE.CanvasTexture + ImageData from a user-uploaded image File.
 */
export function loadCustomTexture(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { w, h } = fitDimensions(img.width, img.height);
      const canvas = makeCanvas(w, h);
      const ctx    = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const texture   = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.name = file.name;
      resolve({ name: file.name, nameEn: file.name, fullCanvas: canvas, texture, imageData, width: w, height: h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}
