/* Texturizador */

// ── Language registry ─────────────────────────────────────────────────────────
// Only display names live here; full strings are lazy-loaded per language.

export const TRANSLATIONS = {
  es: { 'lang.name': 'Español' },
  en: { 'lang.name': 'English' },
};

// ── Module state ──────────────────────────────────────────────────────────────

let _currentLang = 'es';
const _cache = {};

/**
 * Load a language file into the cache.
 * Returns true on success, false on failure.
 * Marks failed languages with an empty object so we don't retry on every call.
 */
async function _loadLang(lang) {
  if (_cache[lang]) {
    return true;
  }

  try {
    const { default: strings } = await import(`./i18n/${lang}.js`);
    _cache[lang] = strings;
    return true;
  } catch (err) {
    console.error(`[i18n] Failed to load language "${lang}":`, err);
    _cache[lang] = {};
    return false;
  }
}

// ── Core API ──────────────────────────────────────────────────────────────────

function _interpolate(key, params, escape) {
  const strings  = _cache[_currentLang] ?? _cache.es ?? _cache.en ?? {};
  const fallback = _cache.es ?? _cache.en ?? {};
  let str = strings[key] ?? fallback[key] ?? key;

  for (const [k, v] of Object.entries(params)) {
    str = str.replaceAll(`{${k}}`, escape ? _escapeHtml(v) : v);
  }

  return str;
}

const _escapeHtml = (v) => String(v)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

/** Translate key + interpolate {placeholder}s. Text sinks only; innerHTML uses tHtml(). */
export function t(key, params = {}) {
  return _interpolate(key, params, false);
}

/** t() with params HTML-escaped (templates stay raw). For innerHTML sinks. */
export function tHtml(key, params = {}) {
  return _interpolate(key, params, true);
}

export function getLang() {
  return _currentLang;
}

/**
 * Switch the active language.
 * Returns true if the requested language loaded successfully, false if it fell
 * back to English due to a network/parse error.
 */
export async function setLang(lang) {
  if (!TRANSLATIONS[lang]) {
    return false;
  }

  const ok = await _loadLang(lang);
  if (!ok) {
    return false;
  }

  _currentLang = lang;
  localStorage.setItem('texturizador-lang', lang);
  document.documentElement.setAttribute('data-lang', lang);
  document.documentElement.setAttribute('lang', lang);

  applyTranslations();
  return true;
}

/**
 * Walk the DOM and apply translations to elements carrying data-i18n* attributes.
 */
export function applyTranslations() {
  // textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  // innerHTML — templates trusted, params escaped
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = tHtml(el.dataset.i18nHtml);
  });

  // title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });

  // aria-label attribute
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });

  // <option> elements (textContent doesn't work via data-i18n on options in some browsers)
  document.querySelectorAll('option[data-i18n-opt]').forEach(opt => {
    opt.textContent = t(opt.dataset.i18nOpt);
  });
}

/**
 * Detect language from localStorage or the browser, load translation files,
 * and apply. Call once at startup.
 *
 * Returns { enFailed: boolean } — true when even the English base file could
 * not be loaded. The UI will still render but show raw translation keys instead
 * of text. The caller should surface a visible warning in this case.
 */
export async function initLang() {
  const saved = localStorage.getItem('texturizador-lang');

  if (saved && TRANSLATIONS[saved]) {
    _currentLang = saved;
  } else {
    _currentLang = 'es';
  }

  document.documentElement.setAttribute('data-lang', _currentLang);
  document.documentElement.setAttribute('lang', _currentLang);

  const [esOk, enOk] = await Promise.all([_loadLang('es'), _loadLang('en')]);
  if (_currentLang !== 'es' && _currentLang !== 'en') {
    await _loadLang(_currentLang);
  }

  applyTranslations();
  return { enFailed: !esOk && !enOk };
}
