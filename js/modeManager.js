/* Texturizador - Mode Manager */

import { generatePhotoFrame, FRAME_PRESETS, FRAME_SHAPES, FRAME_RELIEFS } from './generators/frameGenerator.js';
import { generatePhoneStand, PHONE_PRESETS } from './generators/phoneStandGenerator.js';
import { generateLamp, LAMP_PRESETS, LAMP_SOCKETS } from './generators/lampGenerator.js';
import { exportSTL, export3MF } from './exporter.js';
import { loadGeometry } from './viewer.js';
import { applyTranslations } from './i18n.js';

let _activeMode = 'texturizer';
let _currentGeometry = null;
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

  // Apply translations to new UI elements
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
    // Restore texturizer mesh in viewer
    if (callbacks_restoreTexturizerMesh) {
      callbacks_restoreTexturizerMesh();
    }
  }
}

let callbacks_restoreTexturizerMesh = null;
export function setRestoreTexturizerCallback(fn) {
  callbacks_restoreTexturizerMesh = fn;
}

// ─── FRAME GENERATOR CONTROLS ─────────────────────────────
function initFrameControls() {
  const shapeSelect = document.getElementById('frame-shape-select');
  const presetSelect = document.getElementById('frame-preset-select');
  const photoW = document.getElementById('frame-photo-w');
  const photoH = document.getElementById('frame-photo-h');
  const customDims = document.getElementById('frame-custom-dims');
  const borderWidth = document.getElementById('frame-border-w');
  const frameDepth = document.getElementById('frame-depth');
  const reliefSelect = document.getElementById('frame-relief-select');
  const kickstand = document.getElementById('frame-kickstand-chk');
  const wallMount = document.getElementById('frame-wallmount-chk');

  const exportStlBtn = document.getElementById('frame-export-stl-btn');
  const export3mfBtn = document.getElementById('frame-export-3mf-btn');
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

  [shapeSelect, photoW, photoH, borderWidth, frameDepth, reliefSelect, kickstand, wallMount].forEach(el => {
    if (el) {
      el.addEventListener('input', scheduleUpdate);
      el.addEventListener('change', scheduleUpdate);
    }
  });

  if (exportStlBtn) {
    exportStlBtn.addEventListener('click', () => {
      if (_currentGeometry) exportSTL(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'marco'}.stl`);
    });
  }

  if (export3mfBtn) {
    export3mfBtn.addEventListener('click', () => {
      if (_currentGeometry) export3MF(_currentGeometry.clone(), `${_currentGeometry.userData.name || 'marco'}.3mf`);
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (_currentGeometry && _onSendToTexturizer) {
        _onSendToTexturizer(_currentGeometry.clone(), _currentGeometry.userData.name || 'marco_fotos');
      }
    });
  }
}

function updateFramePreview() {
  const shape = document.getElementById('frame-shape-select')?.value || 'rectangular';
  const presetKey = document.getElementById('frame-preset-select')?.value || '10x15';
  const photoW = Number(document.getElementById('frame-photo-w')?.value) || 100;
  const photoH = Number(document.getElementById('frame-photo-h')?.value) || 150;
  const borderWidth = Number(document.getElementById('frame-border-w')?.value) || 25;
  const frameDepth = Number(document.getElementById('frame-depth')?.value) || 16;
  const relief = document.getElementById('frame-relief-select')?.value || 'smooth';
  const kickstand = Boolean(document.getElementById('frame-kickstand-chk')?.checked);
  const wallMount = Boolean(document.getElementById('frame-wallmount-chk')?.checked);

  const bwVal = document.getElementById('frame-border-w-val');
  if (bwVal) bwVal.textContent = `${borderWidth} mm`;
  const fdVal = document.getElementById('frame-depth-val');
  if (fdVal) fdVal.textContent = `${frameDepth} mm`;

  _currentGeometry = generatePhotoFrame({
    shape,
    photoW,
    photoH,
    borderWidth,
    frameDepth,
    profileStyle: relief,
    kickstand,
    wallMount,
    isPolaroid: presetKey === 'polaroid'
  });

  loadGeometry(_currentGeometry);
  updateGeneratorBadge('frame', _currentGeometry.userData);
}

// ─── PHONE STAND CONTROLS ─────────────────────────────────
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

  _currentGeometry = generatePhoneStand({
    preset: presetKey,
    width,
    angle,
    slotDepth,
    lipHeight,
    cablePass
  });

  loadGeometry(_currentGeometry);
  updateGeneratorBadge('phone', _currentGeometry.userData);
}

// ─── LAMP GENERATOR CONTROLS ──────────────────────────────
function initLampControls() {
  const presetSelect = document.getElementById('lamp-preset-select');
  const heightSlider = document.getElementById('lamp-height');
  const baseDiamSlider = document.getElementById('lamp-base-diam');
  const topDiamSlider = document.getElementById('lamp-top-diam');
  const wallSlider = document.getElementById('lamp-wall');
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
        if (wallSlider) wallSlider.value = p.wallThickness;
        if (socketSelect) socketSelect.value = p.socket;
      }
      scheduleUpdate();
    });
  }

  [heightSlider, baseDiamSlider, topDiamSlider, wallSlider, socketSelect, cordNotchChk].forEach(el => {
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
  const height = Number(document.getElementById('lamp-height')?.value) || 180;
  const baseDiam = Number(document.getElementById('lamp-base-diam')?.value) || 110;
  const topDiam = Number(document.getElementById('lamp-top-diam')?.value) || 85;
  const wall = Number(document.getElementById('lamp-wall')?.value) || 2.0;
  const socket = document.getElementById('lamp-socket-select')?.value || 'e14';
  const cordNotch = Boolean(document.getElementById('lamp-cord-notch-chk')?.checked);

  const hVal = document.getElementById('lamp-height-val');
  if (hVal) hVal.textContent = `${height} mm`;
  const bdVal = document.getElementById('lamp-base-diam-val');
  if (bdVal) bdVal.textContent = `${baseDiam} mm`;
  const tdVal = document.getElementById('lamp-top-diam-val');
  if (tdVal) tdVal.textContent = `${topDiam} mm`;
  const wVal = document.getElementById('lamp-wall-val');
  if (wVal) wVal.textContent = `${wall} mm`;

  _currentGeometry = generateLamp({
    preset: presetKey,
    height,
    baseDiam,
    topDiam,
    wallThickness: wall,
    socket,
    cordNotch
  });

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
