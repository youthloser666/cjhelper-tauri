import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appStore } from '../../../src/shared/state/app-store.js';
import { initThemeController } from '../../../src/app/theme-controller.js';
import { resolveTileLayerSpecs } from '../../../src/features/maps/logic/map-tile-config.js';

function createFakeClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...tokens) => tokens.forEach((t) => set.add(t)),
    remove: (...tokens) => tokens.forEach((t) => set.delete(t)),
    contains: (token) => set.has(token),
    toggle: (token, force) => {
      const shouldAdd = force === undefined ? !set.has(token) : Boolean(force);
      if (shouldAdd) set.add(token);
      else set.delete(token);
      return shouldAdd;
    },
  };
}

function createThemeDocument() {
  const listeners = new Map();
  const attrs = new Map();
  const themeButton = {
    id: 'btn-theme',
    textContent: '',
    title: '',
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    click: () => {
      for (const fn of listeners.get('click') ?? []) {
        fn({ type: 'click', target: themeButton });
      }
    },
  };

  return {
    body: { classList: createFakeClassList() },
    getElementById: (id) => (id === 'btn-theme' ? themeButton : null),
    themeButton,
  };
}

describe('theme-controller', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    appStore.setState({ theme: 'dark' });
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('defaults to Linear dark mode on mount with mutually exclusive body classes and crisp glyph', () => {
    const doc = createThemeDocument();
    globalThis.document = doc;

    const controller = initThemeController();

    assert.equal(controller.isLightTheme(), false);
    assert.equal(doc.body.classList.contains('dark'), true);
    assert.equal(doc.body.classList.contains('light'), false);
    assert.equal(appStore.getState('theme'), 'dark');
    assert.equal(doc.themeButton.textContent, '◐');
    assert.equal(doc.themeButton.getAttribute('aria-label'), 'Switch to light mode');
  });

  it('toggles between Linear dark default and inverse light mode, emits theme:changed, and keeps auto map basemap switching synchronized', () => {
    const doc = createThemeDocument();
    globalThis.document = doc;

    const emittedEvents = [];
    const callbackValues = [];
    const unsubscribe = appStore.on('theme:changed', (payload) => emittedEvents.push(payload));

    const controller = initThemeController({
      onThemeChanged: (isLight) => callbackValues.push(isLight),
    });

    const initialLayers = resolveTileLayerSpecs({
      tileType: 'auto',
      isLight: controller.isLightTheme(),
    });
    assert.match(initialLayers[0].url, /World_Dark_Gray_Base/);

    doc.themeButton.click();

    assert.equal(controller.isLightTheme(), true);
    assert.equal(doc.body.classList.contains('light'), true);
    assert.equal(doc.body.classList.contains('dark'), false);
    assert.equal(appStore.getState('theme'), 'light');
    assert.equal(doc.themeButton.textContent, '◑');
    assert.equal(doc.themeButton.getAttribute('aria-label'), 'Switch to dark mode');

    const lightLayers = resolveTileLayerSpecs({
      tileType: 'auto',
      isLight: controller.isLightTheme(),
    });
    assert.match(lightLayers[0].url, /openstreetmap\.org/);

    doc.themeButton.click();

    assert.equal(controller.isLightTheme(), false);
    assert.equal(doc.body.classList.contains('dark'), true);
    assert.equal(doc.body.classList.contains('light'), false);
    assert.deepEqual(callbackValues, [false, true, false]);
    assert.deepEqual(emittedEvents, [{ isLight: false }, { isLight: true }, { isLight: false }]);

    unsubscribe();
  });

  it('respects an existing light preference if stored before startup initialization', () => {
    appStore.setState({ theme: 'light' });
    const doc = createThemeDocument();
    globalThis.document = doc;

    const controller = initThemeController();

    assert.equal(controller.isLightTheme(), true);
    assert.equal(doc.body.classList.contains('light'), true);
    assert.equal(doc.body.classList.contains('dark'), false);
    assert.equal(doc.themeButton.textContent, '◑');
    assert.equal(doc.themeButton.getAttribute('aria-label'), 'Switch to dark mode');
  });
});

