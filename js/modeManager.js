/* Texturizador - Mode Manager with Multi-Part & Multi-Plate Support */

import { generatePhotoFrame, getPhotoFrameParts, createFrontFrame, FRAME_PRESETS, FRAME_SHAPES, FRAME_RELIEFS } from './generators/frameGenerator.js';
import { generatePhoneStand, PHONE_PRESETS } from './generators/phoneStandGenerator.js';
import { generateLamp, LAMP_PRESETS, LAMP_SOCKETS, CALIBRATED_WALLS } from './generators/lampGenerator.js';
import { exportSTL, export3MF, exportMultiSTLZip } from './exporter.js';
import { loadGeometry } from './viewer.js';
import { applyTranslations } from './i18n.js';

let _activeMode = 'texturizer';
let _currentGeometry = null;
let _currentParams = {};
let _updateTimer = null;

// Callbacks set by main.js
let _onSendToTexturizer = null;

export function initModeManager(callbacks = {}) {
  _onSendToTexturizer = callbacks.onSendToTexturizer;

  // Setup tab switcher buttons
  const tabs = document.querySelectorAll('.mode-nav-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      switchMode(mode);
    });
  });

  initFrameControls();
  initPhoneControls();
  initLampControls();

  // Apply translations to UI elements
  applyTranslations();
}

/**
 * Switch active application mode.
 */
export function switchMode(mode) {
  if (mode === _activeMode) return;
  _activeMode = mode;

  // 1. Update navigation tabs
  document.querySelectorAll('.mode-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // 2. Toggle panels in sidebar
  const panels = {
    texturizer: document.getElementById('mode-panel-texturizer'),
    frame: document.getElementById('mode-panel-frame'),
    phone: document.getElementById('mode-panel-phone'),
    lamp: document.getElementById('mode-panel-lamp')
  };

  for (const [key, el] of Object.entries(panels)) {
    if (el) {
      el.classList.toggle('hidden', key !== mode);
      el.classList.toggle('active', key === mode);
    }
  }

  // 3. Drop zone visibility
  const dropHint = document.getElementById('drop-hint');
  if (dropHint) {
    if (mode === 'texturizer') {
      const hasMesh = window.__hasActiveTexturizerMesh && window.__hasActiveTexturizerMesh();
      dropHint.classList.toggle('hidden', !!hasMesh);
    } else {
      dropHint.classList.add('hidden');
    }
  }

  // 4. If switching to a generator mode, render preview
  if (mode === 'frame') {
    updateFramePreview();
  } else if (mode === 'phone') {
    updatePhonePreview();
  } else if (mode === 'lamp') {
    updateLampPreview();
  } else if (mode === 'texturizer') {
    if (callbacks_restoreTexturizerMesh) {
      callbacks_restoreTexturizerMesh();
    }
  }
}

let callbacks_restoreTexturizerMesh = null;
export function setRestoreTexturizerCallback(fn) {
  callbacks_restoreTexturizerMesh = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME GENERATOR CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function initFrameControls() {
  const shapeSelect = document.getElementById('frame-shape-select');
  const presetSelect = document.getElementById('frame-preset-select');
  const viewSelect = document.getElementById('frame-view-select');
  const photoW = document.getElementById('frame-photo-w');
  const photoH = document.getElementById('frame-photo-h');
  const customDims = document.getElementById('frame-custom-dims');
  const borderWidth = document.getElementById('frame-border-w');
  const frameDepth = document.getElementById('frame-depth');
  const reliefSelect = document.getElementById('frame-relief-select');

  const exportStlBtn = document.getElementById('frame-export-stl-btn');
  const export3mfBtn = document.getElementById('frame-export-3mf-btn');
  const exportZipBtn = document.getElementById('frame-export-zip-btn');
  const sendBtn = document.getElementById('frame-send-texturizer-btn');

  function scheduleUpdate() {
    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(updateFramePreview, 60);
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const key = presetSelect.value;
      const p = FRAME_PRESETS[key];
      if (p && customDims) {
        if (key === 'custom') {
          customDims.classList.remove('hidden');
        } else {
          customDims.classList.add('hidden');
          if (photoW) photoW.value = p.photoW;
          if (photoH) photoH.value = p.photoH;
        }
      }
      scheduleUpdate();
    });
  }

  [shapeSelect, viewSelect, photoW, photoH, borderWidth, frameDepth, reliefSelect].forEach(el => {
    if (el) {
      el.addEventListener('input', scheduleUpdate);
      el.addEventListener('change', scheduleUpdate);
    }
  });

  if (exportStlBtn) {
    exportStlBtn.addEventListener('click', () => {
      if (_currentGeometry) {
        exportSTL(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'marco_3d'}.stl`);
      }
    });
  }

  if (export3mfBtn) {
    export3mfBtn.addEventListener('click', () => {
      if (_currentGeometry) {
        export3MF(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'marco_3d'}.3mf`);
      }
    });
  }

  // Descargar ZIP con todas las piezas independientes (marco, tapa, pata, clips)
  if (exportZipBtn) {
    exportZipBtn.addEventListener('click', () => {
      const parts = getPhotoFrameParts(_currentParams.frame || {});
      const photoW = _currentParams.frame?.photoW || 100;
      const photoH = _currentParams.frame?.photoH || 150;
      const shape = _currentParams.frame?.shape || 'rect';

      const partsDict = {
        [`01_marco_frontal_${shape}_${photoW}x${photoH}.stl`]: parts.front,
        [`02_tapa_trasera_${shape}_${photoW}x${photoH}.stl`]: parts.backplate,
        [`03_pata_apoyo_abatible.stl`]: parts.stand,
        [`04_clips_cierre_4x.stl`]: parts.clips
      };
      exportMultiSTLZip(partsDict, `kit_marco_${shape}_${photoW}x${photoH}_piezas.zip`);
    });
  }

  // "Enviar a Texturizado": traslada el MARCO FRONTAL decorativo al texturizador
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const frontGeom = createFrontFrame(_currentParams.frame || {});
      if (_onSendToTexturizer) {
        _onSendToTexturizer(frontGeom, frontGeom.userData.name || 'marco_frontal');
      }
    });
  }
}

function updateFramePreview() {
  const shape = document.getElementById('frame-shape-select')?.value || 'rectangular';
  const presetKey = document.getElementById('frame-preset-select')?.value || '10x15';
  const viewMode = document.getElementById('frame-view-select')?.value || 'assembled';
  const photoW = Number(document.getElementById('frame-photo-w')?.value) || 100;
  const photoH = Number(document.getElementById('frame-photo-h')?.value) || 150;
  const borderWidth = Number(document.getElementById('frame-border-w')?.value) || 25;
  const frameDepth = Number(document.getElementById('frame-depth')?.value) || 16;
  const relief = document.getElementById('frame-relief-select')?.value || 'smooth';

  const bwVal = document.getElementById('frame-border-w-val');
  if (bwVal) bwVal.textContent = `${borderWidth} mm`;
  const fdVal = document.getElementById('frame-depth-val');
  if (fdVal) fdVal.textContent = `${frameDepth} mm`;

  const params = {
    shape,
    photoW,
    photoH,
    borderWidth,
    frameDepth,
    profileStyle: relief,
    viewMode,
    isPolaroid: presetKey === 'polaroid'
  };
  _currentParams.frame = params;

  _currentGeometry = generatePhotoFrame(params);
  loadGeometry(_currentGeometry);
  updateGeneratorBadge('frame', _currentGeometry.userData);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHONE STAND CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function initPhoneControls() {
  const presetSelect = document.getElementById('phone-preset-select');
  const widthSlider = document.getElementById('phone-width');
  const angleSlider = document.getElementById('phone-angle');
  const slotDepthSlider = document.getElementById('phone-slot-depth');
  const lipHeightSlider = document.getElementById('phone-lip-height');
  const cablePassChk = document.getElementById('phone-cable-chk');

  const exportStlBtn = document.getElementById('phone-export-stl-btn');
  const export3mfBtn = document.getElementById('phone-export-3mf-btn');
  const sendBtn = document.getElementById('phone-send-texturizer-btn');

  function scheduleUpdate() {
    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(updatePhonePreview, 60);
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const p = PHONE_PRESETS[presetSelect.value];
      if (p) {
        if (widthSlider) widthSlider.value = p.width;
        if (angleSlider) angleSlider.value = p.angle;
        if (slotDepthSlider) slotDepthSlider.value = p.slotDepth;
        if (lipHeightSlider) lipHeightSlider.value = p.lipHeight;
        if (cablePassChk) cablePassChk.checked = p.cablePass;
      }
      scheduleUpdate();
    });
  }

  [widthSlider, angleSlider, slotDepthSlider, lipHeightSlider, cablePassChk].forEach(el => {
    if (el) {
      el.addEventListener('input', scheduleUpdate);
      el.addEventListener('change', scheduleUpdate);
    }
  });

  if (exportStlBtn) {
    exportStlBtn.addEventListener('click', () => {
      if (_currentGeometry) exportSTL(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'soporte_movil'}.stl`);
    });
  }

  if (export3mfBtn) {
    export3mfBtn.addEventListener('click', () => {
      if (_currentGeometry) export3MF(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'soporte_movil'}.3mf`);
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (_currentGeometry && _onSendToTexturizer) {
        _onSendToTexturizer(_currentGeometry.clone(), _currentGeometry.userData.name || 'soporte_movil');
      }
    });
  }
}

function updatePhonePreview() {
  const presetKey = document.getElementById('phone-preset-select')?.value || 'compact';
  const width = Number(document.getElementById('phone-width')?.value) || 65;
  const angle = Number(document.getElementById('phone-angle')?.value) || 60;
  const slotDepth = Number(document.getElementById('phone-slot-depth')?.value) || 14;
  const lipHeight = Number(document.getElementById('phone-lip-height')?.value) || 14;
  const cablePass = Boolean(document.getElementById('phone-cable-chk')?.checked);

  const wVal = document.getElementById('phone-width-val');
  if (wVal) wVal.textContent = `${width} mm`;
  const aVal = document.getElementById('phone-angle-val');
  if (aVal) aVal.textContent = `${angle}°`;
  const sdVal = document.getElementById('phone-slot-depth-val');
  if (sdVal) sdVal.textContent = `${slotDepth} mm`;
  const lhVal = document.getElementById('phone-lip-height-val');
  if (lhVal) lhVal.textContent = `${lipHeight} mm`;

  const params = {
    preset: presetKey,
    width,
    angle,
    slotDepth,
    lipHeight,
    cablePass
  };
  _currentParams.phone = params;

  _currentGeometry = generatePhoneStand(params);
  loadGeometry(_currentGeometry);
  updateGeneratorBadge('phone', _currentGeometry.userData);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAMP GENERATOR CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function initLampControls() {
  const presetSelect = document.getElementById('lamp-preset-select');
  const heightSlider = document.getElementById('lamp-height');
  const baseDiamSlider = document.getElementById('lamp-base-diam');
  const topDiamSlider = document.getElementById('lamp-top-diam');
  const wallSelect = document.getElementById('lamp-wall-calibrated');
  const socketSelect = document.getElementById('lamp-socket-select');
  const cordNotchChk = document.getElementById('lamp-cord-notch-chk');

  const exportStlBtn = document.getElementById('lamp-export-stl-btn');
  const export3mfBtn = document.getElementById('lamp-export-3mf-btn');
  const sendBtn = document.getElementById('lamp-send-texturizer-btn');

  function scheduleUpdate() {
    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(updateLampPreview, 60);
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const p = LAMP_PRESETS[presetSelect.value];
      if (p) {
        if (heightSlider) heightSlider.value = p.height;
        if (baseDiamSlider) baseDiamSlider.value = p.baseDiam;
        if (topDiamSlider) topDiamSlider.value = p.topDiam;
        if (socketSelect) socketSelect.value = p.socket;
      }
      scheduleUpdate();
    });
  }

  [heightSlider, baseDiamSlider, topDiamSlider, wallSelect, socketSelect, cordNotchChk].forEach(el => {
    if (el) {
      el.addEventListener('input', scheduleUpdate);
      el.addEventListener('change', scheduleUpdate);
    }
  });

  if (exportStlBtn) {
    exportStlBtn.addEventListener('click', () => {
      if (_currentGeometry) exportSTL(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'lampara'}.stl`);
    });
  }

  if (export3mfBtn) {
    export3mfBtn.addEventListener('click', () => {
      if (_currentGeometry) export3MF(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'lampara'}.3mf`);
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (_currentGeometry && _onSendToTexturizer) {
        _onSendToTexturizer(_currentGeometry.clone(), _currentGeometry.userData.name || 'lampara');
      }
    });
  }
}

function updateLampPreview() {
  const presetKey = document.getElementById('lamp-preset-select')?.value || 'pleated';
  const height = Number(document.getElementById('lamp-height')?.value) || 185;
  const baseDiam = Number(document.getElementById('lamp-base-diam')?.value) || 115;
  const topDiam = Number(document.getElementById('lamp-top-diam')?.value) || 88;
  const wall = Number(document.getElementById('lamp-wall-calibrated')?.value) || 1.26;
  const socket = document.getElementById('lamp-socket-select')?.value || 'e14';
  const cordNotch = Boolean(document.getElementById('lamp-cord-notch-chk')?.checked);

  const hVal = document.getElementById('lamp-height-val');
  if (hVal) hVal.textContent = `${height} mm`;
  const bdVal = document.getElementById('lamp-base-diam-val');
  if (bdVal) bdVal.textContent = `${baseDiam} mm`;
  const tdVal = document.getElementById('lamp-top-diam-val');
  if (tdVal) tdVal.textContent = `${topDiam} mm`;

  const params = {
    preset: presetKey,
    height,
    baseDiam,
    topDiam,
    wallThickness: wall,
    socket,
    cordNotch
  };
  _currentParams.lamp = params;

  _currentGeometry = generateLamp(params);
  loadGeometry(_currentGeometry);
  updateGeneratorBadge('lamp', _currentGeometry.userData);
}

function updateGeneratorBadge(mode, userData) {
  const badge = document.getElementById(`${mode}-info-badge`);
  if (!badge || !userData) return;
  const d = userData.dimensions || {};
  let dimStr = '';
  if (d.width && d.height && d.depth) {
    dimStr = `${d.width} × ${d.height} × ${d.depth} mm`;
  } else if (d.width && d.depth && d.height) {
    dimStr = `${d.width} × ${d.depth} × ${d.height} mm`;
  } else if (d.diameter && d.height) {
    dimStr = `Ø ${d.diameter} × ${d.height} mm`;
  }
  const tris = (userData.triangles || 0).toLocaleString();
  badge.textContent = `📐 ${dimStr} · 🔺 ${tris} triángulos`;
}
