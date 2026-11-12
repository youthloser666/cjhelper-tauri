import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appStore } from '../../../src/shared/state/app-store.js';
import { initDashboardView } from '../../../src/features/dashboard/ui/dashboard.view.js';

function createFakeElement(id = '', { classes = [], dataset = {} } = {}) {
  const classSet = new Set(classes);
  const listeners = new Map();
  const children = [];

  const element = {
    id,
    textContent: '',
    title: '',
    disabled: false,
    dataset: { ...dataset },
    children,
    classList: {
      add: (...tokens) => tokens.forEach((t) => classSet.add(t)),
      remove: (...tokens) => tokens.forEach((t) => classSet.delete(t)),
      contains: (token) => classSet.has(token),
      toggle: (token, force) => {
        const shouldAdd = force === undefined ? !classSet.has(token) : Boolean(force);
        if (shouldAdd) classSet.add(token);
        else classSet.delete(token);
        return shouldAdd;
      },
    },
    addEventListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent: (type, event = {}) => {
      const target = event.target ?? element;
      const evt = { type, target, ...event };
      for (const handler of listeners.get(type) ?? []) {
        handler(evt);
      }
    },
    click: () => {
      element.dispatchEvent('click', { target: element });
    },
    appendChild: (child) => {
      children.push(child);
      return child;
    },
    contains: (node) => node === element || children.includes(node),
    closest: (selector) => {
      const cls = selector.startsWith('.') ? selector.slice(1) : selector;
      return classSet.has(cls) ? element : null;
    },
    querySelectorAll: (selector) => {
      const cls = selector.startsWith('.') ? selector.slice(1) : selector;
      return children.filter((child) => child.classList.contains(cls));
    },
  };

  return element;
}

function createDashboardDocument() {
  const elements = new Map();
  const register = (id, opts) => {
    const el = createFakeElement(id, opts);
    elements.set(id, el);
    return el;
  };

  const regionFilter = register('dash-region-filter');
  const btnAll = createFakeElement('', { classes: ['seg-btn', 'active'], dataset: { val: 'ALL' } });
  const btnCjn = createFakeElement('', { classes: ['seg-btn'], dataset: { val: 'CJN' } });
  const btnCjs = createFakeElement('', { classes: ['seg-btn'], dataset: { val: 'CJS' } });
  regionFilter.appendChild(btnAll);
  regionFilter.appendChild(btnCjn);
  regionFilter.appendChild(btnCjs);

  [
    'btn-load-db',
    'btn-dash-import-contact',
    'btn-dash-import-mplane',
    'btn-dash-handover-te',
    'btn-dash-handover-site',
    'dash-changes-card',
    'btn-dash-load-json',
    'btn-dash-save-json',
    'dash-down',
    'dash-up',
    'dash-db',
    'lbl-dash-db-filename',
    'dash-contact-total',
    'dash-contact-valid',
    'dash-contact-unset',
    'dash-contact-clusters',
    'dash-changes-count',
    'lbl-dash-changes-filename',
  ].forEach((id) => register(id));

  return {
    getElementById: (id) => elements.get(id) ?? null,
    regionButtons: { btnAll, btnCjn, btnCjs, regionFilter },
  };
}

describe('dashboard.view', () => {
  const originalDocument = globalThis.document;
  let viewHandle;

  beforeEach(() => {
    appStore.setState({
      activeRegionFilter: 'ALL',
      statusData: [],
      waTeContacts: [],
      siteChanges: { overrides: {} },
      lastLoadedChangesFileName: '',
      databaseLoad: {
        status: 'idle',
        fileName: '',
        rowCount: 0,
        errorMessage: '',
      },
    });
  });

  afterEach(() => {
    viewHandle?.destroy?.();
    viewHandle = null;
    globalThis.document = originalDocument;
  });

  it('wires all 8 Dashboard action triggers and keeps Site Overrides distinct from Handover Site', () => {
    const doc = createDashboardDocument();
    globalThis.document = doc;

    const calls = [];
    viewHandle = initDashboardView({
      onLoadDatabase: () => calls.push('loadDatabase'),
      onImportContacts: () => calls.push('importContacts'),
      onImportMplane: () => calls.push('importMplane'),
      onOpenHandoverTe: () => calls.push('openHandoverTe'),
      onOpenHandoverSite: () => calls.push('openHandoverSite'),
      onOpenSiteChanges: () => calls.push('openSiteChanges'),
      onLoadChangesJson: () => calls.push('loadChangesJson'),
      onSaveChangesJson: () => calls.push('saveChangesJson'),
    });

    doc.getElementById('btn-load-db').click();
    doc.getElementById('btn-dash-import-contact').click();
    doc.getElementById('btn-dash-import-mplane').click();
    doc.getElementById('btn-dash-handover-te').click();
    doc.getElementById('btn-dash-handover-site').click();
    doc.getElementById('dash-changes-card').click();
    doc.getElementById('btn-dash-load-json').click();
    doc.getElementById('btn-dash-save-json').click();

    assert.deepEqual(calls, [
      'loadDatabase',
      'importContacts',
      'importMplane',
      'openHandoverTe',
      'openHandoverSite',
      'openSiteChanges',
      'loadChangesJson',
      'saveChangesJson',
    ]);
  });

  it('switches activeRegionFilter and triggers onRegionChange when region buttons click', () => {
    const doc = createDashboardDocument();
    globalThis.document = doc;

    const regions = [];
    viewHandle = initDashboardView({
      onRegionChange: (region) => regions.push(region),
    });

    const { regionFilter, btnCjn, btnAll } = doc.regionButtons;
    regionFilter.dispatchEvent('click', { target: btnCjn });

    assert.equal(appStore.getState('activeRegionFilter'), 'CJN');
    assert.equal(btnCjn.classList.contains('active'), true);
    assert.equal(btnAll.classList.contains('active'), false);
    assert.deepEqual(regions, ['CJN']);
  });

  it('synchronizes appStore databaseLoad idle, loading, loaded, and error states to Dashboard DOM', () => {
    const doc = createDashboardDocument();
    globalThis.document = doc;

    viewHandle = initDashboardView();

    const loadButton = doc.getElementById('btn-load-db');
    const countEl = doc.getElementById('dash-db');
    const labelEl = doc.getElementById('lbl-dash-db-filename');

    assert.equal(countEl.textContent, '0');
    assert.equal(labelEl.textContent, 'Not loaded');
    assert.equal(loadButton.disabled, false);

    appStore.setState({
      databaseLoad: { status: 'loading', fileName: '', rowCount: 0, errorMessage: '' },
    });
    assert.equal(loadButton.disabled, true);
    assert.equal(labelEl.textContent, 'Loading DB...');

    appStore.setState({
      databaseLoad: { status: 'loaded', fileName: 'db-new.xlsx', rowCount: 412, errorMessage: '' },
    });
    assert.equal(loadButton.disabled, false);
    assert.equal(countEl.textContent, '412');
    assert.equal(labelEl.textContent, '📁 db-new.xlsx (412 baris)');

    appStore.setState({
      databaseLoad: { status: 'error', fileName: '', rowCount: 0, errorMessage: 'Gagal memuat DB' },
    });
    assert.equal(loadButton.disabled, false);
    assert.equal(countEl.textContent, '0');
    assert.equal(labelEl.textContent, 'Gagal memuat DB');
  });
});

