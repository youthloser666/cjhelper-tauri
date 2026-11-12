import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeDashboardMetrics } from '../../../src/features/dashboard/logic/dashboard-metrics.js';

describe('dashboard-metrics', () => {
  it('computes status, override, and contact metrics for ALL region filter', () => {
    const metrics = computeDashboardMetrics({
      regionFilter: 'ALL',
      statusData: [
        { new_site: 'SMG001', site_name: 'Semarang Timur', cluster: 'Semarang', status: 'DOWN' },
        { new_site: 'SLO001', site_name: 'Solo Baru', cluster: 'Solo', status: 'UP' },
        { new_site: 'KDS001', site_name: 'Kudus Kota', cluster: 'Kudus', status: 'DOWN' },
      ],
      contacts: [
        { name: 'TE A', cluster: 'Semarang', phone: '081234567890' },
        { name: 'TE B', cluster: 'Solo', phone: '' },
        { name: 'TE C', cluster: 'semarang', phone: '+628111222333' },
      ],
      siteChanges: {
        overrides: {
          SMG001: { 'TE Name': 'TE Baru' },
          SLO001: { 'TE Name': 'TE Lain' },
        },
      },
      lastLoadedChangesFileName: 'changes_nov.json',
    });

    assert.equal(metrics.downCount, 2);
    assert.equal(metrics.upCount, 1);
    assert.equal(metrics.contactTotal, 3);
    assert.equal(metrics.contactValid, 2);
    assert.equal(metrics.contactUnset, 1);
    assert.equal(metrics.contactClusters, 2);
    assert.equal(metrics.overridesCount, 2);
    assert.equal(metrics.changesSummaryText, '📁 changes_nov.json');
    assert.equal(metrics.changesTone, 'loaded');
  });

  it('filters status and contact metrics strictly by CJN or CJS region', () => {
    const metrics = computeDashboardMetrics({
      regionFilter: 'CJS',
      statusData: [
        { new_site: 'SMG001', site_name: 'Semarang Barat', cluster: 'Semarang', status: 'DOWN' },
        { new_site: 'SLO001', site_name: 'Solo Kota', cluster: 'Solo', status: 'DOWN' },
        { new_site: 'KLT001', site_name: 'Klaten Barat', cluster: 'Klaten', status: 'UP' },
      ],
      contacts: [
        { name: 'TE CJN', cluster: 'Semarang', phone: '081234567890' },
        { name: 'TE CJS', cluster: 'Solo', phone: '081999888777' },
      ],
      siteChanges: {
        overrides: {
          SMG001: {},
        },
      },
      lastLoadedChangesFileName: '',
    });

    assert.equal(metrics.downCount, 1);
    assert.equal(metrics.upCount, 1);
    assert.equal(metrics.contactTotal, 1);
    assert.equal(metrics.contactValid, 1);
    assert.equal(metrics.contactUnset, 0);
    assert.equal(metrics.contactClusters, 1);
    assert.equal(metrics.overridesCount, 1);
    assert.equal(metrics.changesSummaryText, '1 site diubah');
    assert.equal(metrics.changesTone, 'dirty');
  });
});

