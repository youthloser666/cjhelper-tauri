import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import {
  LOOKUP_FIELD_DEFS,
  buildSiteDatabaseCopyText,
  extractLookupDisplayFields,
} from '../logic/site-editor-service.js';

/**
 * Controls the Database Lookup tab (`#tab-db`) search, clipboard actions, and handover trigger.
 */
export function mountDatabaseLookupView({
  appStore,
  tauriBridge,
  clipboardAdapter,
  onImportMplane = null,
  onOpenHandoverSite = null,
}) {
  const searchInput = getElementById('db-search-input');
  const btnSearch = getElementById('btn-db-search');
  const btnClear = getElementById('btn-db-clear');
  const searchStatus = getElementById('db-search-status');
  const btnCopyAll = getElementById('btn-db-copy-all');
  const btnImportMplane = getElementById('btn-db-import-mplane');
  const btnHandoverSite = getElementById('btn-db-lookup-handover');

  const fieldElements = new Map();
  for (const [fieldKey] of LOOKUP_FIELD_DEFS) {
    const el = getElementById(`db-f-${fieldKey}`);
    if (el) {
      fieldElements.set(fieldKey, el);
    }
  }

  function resetFields() {
    appStore.setState({ lastDbRow: null });
    for (const el of fieldElements.values()) {
      el.textContent = '—';
      el.classList.add('em');
    }
    if (searchStatus) searchStatus.textContent = '';
  }

  function renderRow(row) {
    appStore.setState({ lastDbRow: row });
    const displayValues = extractLookupDisplayFields(row);

    for (const [fieldKey, el] of fieldElements.entries()) {
      if (fieldKey === 'mplane-ip-address') continue;
      const text = displayValues[fieldKey] || '—';
      el.textContent = text;
      el.classList.toggle('em', text === '—' || !text);
    }

    const mplaneEl = fieldElements.get('mplane-ip-address');
    if (mplaneEl) {
      const mplaneAddr = displayValues['mplane-ip-address'];
      if (mplaneAddr && mplaneAddr !== '—') {
        mplaneEl.innerHTML = `<a href="#" class="mplane-open-link">${escapeHtml(mplaneAddr)}</a>`;
        mplaneEl.classList.remove('em');
        mplaneEl.querySelector('.mplane-open-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          tauriBridge.openExternalUrl(mplaneAddr);
        });
      } else {
        mplaneEl.textContent = '—';
        mplaneEl.classList.add('em');
      }
    }
  }

  async function lookupSite() {
    const siteId = (searchInput?.value || '').trim().toUpperCase();
    if (!siteId) return;

    if (searchStatus) searchStatus.textContent = 'Searching...';

    try {
      const row = await tauriBridge.lookupSite(siteId);
      if (!row) {
        if (searchStatus) searchStatus.textContent = 'Not found in database';
        return;
      }

      if (searchStatus) searchStatus.textContent = '';
      renderRow(row);
    } catch (err) {
      if (searchStatus) searchStatus.textContent = `Error: ${err}`;
    }
  }

  btnSearch?.addEventListener('click', lookupSite);
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      lookupSite();
    }
  });

  btnClear?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    resetFields();
  });

  btnCopyAll?.addEventListener('click', async () => {
    const lastDbRow = appStore.getState('lastDbRow');
    if (!lastDbRow) return;
    const summaryText = buildSiteDatabaseCopyText(lastDbRow);
    await clipboardAdapter.writeText(summaryText);
    flashTemporaryFeedback(btnCopyAll, 'Copied!');
  });

  btnImportMplane?.addEventListener('click', () => {
    onImportMplane?.();
  });

  btnHandoverSite?.addEventListener('click', () => {
    const currentId = (
      fieldElements.get('site-id-new')?.textContent ||
      searchInput?.value ||
      ''
    ).trim();
    if (currentId && currentId !== '—') {
      onOpenHandoverSite?.(currentId);
    } else {
      onOpenHandoverSite?.('');
    }
  });

  for (const el of fieldElements.values()) {
    el.addEventListener('click', async () => {
      const text = el.textContent?.trim();
      if (!text || text === '—') return;
      await clipboardAdapter.writeText(text);
      el.classList.add('copied-flash');
      setTimeout(() => el.classList.remove('copied-flash'), 1000);
    });
  }

  return {
    lookupSite,
    resetFields,
  };
}

