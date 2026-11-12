import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initWindowController } from '../../../src/app/window-controller.js';

function createMockElement({ id = '', tagName = 'DIV', attrs = {}, dataset = {} } = {}) {
  const listeners = new Map();
  const attrMap = new Map(Object.entries(attrs));

  const element = {
    id,
    tagName,
    title: '',
    dataset: { ...dataset },
    setAttribute: (name, value) => {
      attrMap.set(name, String(value));
      if (name === 'data-maximized') element.dataset.maximized = String(value);
    },
    getAttribute: (name) => {
      if (name === 'data-maximized' && element.dataset.maximized !== undefined) {
        return element.dataset.maximized;
      }
      return attrMap.has(name) ? attrMap.get(name) : null;
    },
    hasAttribute: (name) => attrMap.has(name),
    addEventListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent: (type, event = {}) => {
      const evt = {
        type,
        button: 0,
        detail: 1,
        target: element,
        preventDefault: () => {},
        ...event,
      };
      for (const handler of listeners.get(type) ?? []) {
        handler(evt);
      }
    },
    click: () => element.dispatchEvent('click'),
    closest: (selector) => {
      const tokens = selector.split(',').map((s) => s.trim().toLowerCase());
      const tag = element.tagName.toLowerCase();
      for (const token of tokens) {
        if (token === tag) return element;
        if (token === '[data-no-drag]' && element.hasAttribute('data-no-drag')) return element;
      }
      return null;
    },
  };

  return element;
}

describe('window-controller', () => {
  const originalDocument = globalThis.document;
  let controller;

  afterEach(() => {
    controller?.destroy?.();
    controller = null;
    globalThis.document = originalDocument;
  });

  function setupTestEnv({ initialMaximized = false } = {}) {
    let maximized = initialMaximized;
    let resizeHandler = null;
    const calls = [];

    const titlebar = createMockElement({ id: 'app-titlebar', tagName: 'HEADER' });
    const minBtn = createMockElement({ id: 'btn-win-min', tagName: 'BUTTON', attrs: { 'data-no-drag': '' } });
    const maxBtn = createMockElement({
      id: 'btn-win-max',
      tagName: 'BUTTON',
      attrs: { 'data-no-drag': '' },
      dataset: { maximized: 'false' },
    });
    const closeBtn = createMockElement({ id: 'btn-win-close', tagName: 'BUTTON', attrs: { 'data-no-drag': '' } });
    const navBtn = createMockElement({ id: 'nav-sample', tagName: 'BUTTON' });
    const noDragChild = createMockElement({ id: 'clock-wrap', tagName: 'DIV', attrs: { 'data-no-drag': '' } });

    const byId = new Map([
      ['app-titlebar', titlebar],
      ['btn-win-min', minBtn],
      ['btn-win-max', maxBtn],
      ['btn-win-close', closeBtn],
    ]);

    globalThis.document = {
      getElementById: (id) => byId.get(id) ?? null,
    };

    const windowAdapter = {
      startDragging: async () => {
        calls.push('startDragging');
      },
      minimize: async () => {
        calls.push('minimize');
      },
      toggleMaximize: async () => {
        maximized = !maximized;
        calls.push('toggleMaximize');
      },
      isMaximized: async () => maximized,
      close: async () => {
        calls.push('close');
      },
      onResized: async (cb) => {
        resizeHandler = cb;
        return () => {
          resizeHandler = null;
          calls.push('unlistenResized');
        };
      },
    };

    return {
      titlebar,
      minBtn,
      maxBtn,
      closeBtn,
      navBtn,
      noDragChild,
      calls,
      windowAdapter,
      triggerResize: async (nextMaximized) => {
        maximized = nextMaximized;
        await resizeHandler?.();
      },
    };
  }

  it('wires minimize, toggleMaximize, close, and syncs data-maximized + aria-label via onResized', async () => {
    const env = setupTestEnv({ initialMaximized: false });
    controller = initWindowController({ windowAdapter: env.windowAdapter });

    await controller.ready;
    assert.equal(env.maxBtn.dataset.maximized, 'false');
    assert.equal(env.maxBtn.getAttribute('aria-label'), 'Maximize window');

    env.minBtn.click();
    env.maxBtn.click();
    env.closeBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    assert.deepEqual(env.calls, ['minimize', 'toggleMaximize', 'close']);
    assert.equal(env.maxBtn.dataset.maximized, 'true');
    assert.equal(env.maxBtn.getAttribute('aria-label'), 'Restore window');

    await env.triggerResize(false);
    assert.equal(env.maxBtn.dataset.maximized, 'false');
    assert.equal(env.maxBtn.getAttribute('aria-label'), 'Maximize window');
  });

  it('starts dragging on primary mousedown and toggles maximize on dblclick only outside interactive controls', async () => {
    const env = setupTestEnv({ initialMaximized: false });
    controller = initWindowController({ windowAdapter: env.windowAdapter });
    await controller.ready;

    // Ignored: right mouse click on header
    env.titlebar.dispatchEvent('mousedown', { button: 2, target: env.titlebar });
    // Ignored: interactive controls on mousedown and dblclick
    env.titlebar.dispatchEvent('mousedown', { button: 0, target: env.navBtn });
    env.titlebar.dispatchEvent('mousedown', { button: 0, target: env.noDragChild });
    env.titlebar.dispatchEvent('dblclick', { target: env.navBtn });
    env.titlebar.dispatchEvent('dblclick', { target: env.noDragChild });

    assert.deepEqual(env.calls, []);

    // Allowed: primary mousedown and dblclick on empty header chrome
    env.titlebar.dispatchEvent('mousedown', { button: 0, detail: 1, target: env.titlebar });
    env.titlebar.dispatchEvent('dblclick', { target: env.titlebar });
    await new Promise((r) => setTimeout(r, 0));

    assert.deepEqual(env.calls, ['startDragging', 'toggleMaximize']);
    assert.equal(env.maxBtn.dataset.maximized, 'true');
  });
});

