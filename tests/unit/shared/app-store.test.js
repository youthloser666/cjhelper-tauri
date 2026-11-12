import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAppStore } from '../../../src/shared/state/app-store.js';

describe('app-store', () => {
  it('initializes default state and notifies slice subscribers on updates', () => {
    const store = createAppStore();
    const events = [];

    const unsubscribe = store.subscribe('activeTab', (next, prev) => {
      events.push({ next, prev });
    });

    assert.equal(store.getState('activeTab'), 'dashboard');
    store.setState({ activeTab: 'messages', activeRegionFilter: 'CJS' });

    assert.equal(store.getState('activeTab'), 'messages');
    assert.equal(store.getState('activeRegionFilter'), 'CJS');
    assert.deepEqual(events, [{ next: 'messages', prev: 'dashboard' }]);

    unsubscribe();
    store.setState({ activeTab: 'maps' });
    assert.equal(events.length, 1);
  });

  it('emits custom cross-feature domain events via pub/sub bus', () => {
    const store = createAppStore();
    const received = [];

    const unsubscribe = store.on('formatting:saved', (payload) => {
      received.push(payload);
    });

    store.emit('formatting:saved', { mode: 'msg' });
    assert.deepEqual(received, [{ mode: 'msg' }]);

    unsubscribe();
    store.emit('formatting:saved', { mode: 'bc' });
    assert.equal(received.length, 1);
  });
});

