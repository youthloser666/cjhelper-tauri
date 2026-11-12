import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import {
  addTeContact,
  compactTeContacts,
  filterTeContacts,
} from '../logic/te-contacts-service.js';

/**
 * Controls the TE Contacts Database subtab (`#subtab-wa-te`).
 */
export function mountWaTeContactsView({
  appStore,
  tauriBridge,
  onOpenHandoverTe = null,
}) {
  const inputName = getElementById('wa-te-input-name');
  const inputCluster = getElementById('wa-te-input-cluster');
  const inputPhone = getElementById('wa-te-input-phone');
  const btnAdd = getElementById('btn-wa-te-add');
  const searchInput = getElementById('wa-te-search');
  const btnClearSearch = getElementById('btn-wa-te-clear-search');
  const btnImport = getElementById('btn-wa-te-import');
  const btnHandover = getElementById('btn-wa-te-handover');
  const tbodyEl = getElementById('wa-te-tbody');
  const statusLbl = getElementById('wa-te-status-lbl');
  const btnSave = getElementById('btn-wa-te-save');

  let clearStatusTimer = null;

  function setStatus(text, toneClass = 'text-grn', durationMs = 0) {
    if (!statusLbl) return;
    if (clearStatusTimer) {
      clearTimeout(clearStatusTimer);
      clearStatusTimer = null;
    }
    statusLbl.textContent = text;
    statusLbl.classList.remove('text-grn', 'text-amb', 'text-red');
    if (toneClass) statusLbl.classList.add(toneClass);
    if (durationMs > 0) {
      clearStatusTimer = setTimeout(() => {
        statusLbl.textContent = '';
      }, durationMs);
    }
  }

  function renderTable(filterText = searchInput?.value || '') {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';

    const contacts = appStore.getState('waTeContacts') || [];
    const filtered = filterTeContacts(contacts, filterText);

    if (filtered.length === 0) {
      tbodyEl.innerHTML =
        '<tr><td colspan="4" class="text-center text-subtle py-4">Belum ada kontak disimpan atau pencarian tidak cocok.</td></tr>';
      return;
    }

    for (const contact of filtered) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="fi wa-te-edit-name te-cell-input" value="${escapeHtml(contact.name || '')}"></td>
        <td><input type="text" class="fi wa-te-edit-cluster te-cell-input" value="${escapeHtml(contact.cluster || '')}"></td>
        <td><input type="text" class="fi wa-te-edit-phone te-cell-input" value="${escapeHtml(contact.phone || '')}"></td>
        <td class="text-center">
          <button type="button" class="tbtn-clr btn-wa-te-delete btn-te-delete">Hapus</button>
        </td>
      `;

      tr.querySelector('.wa-te-edit-name').addEventListener('input', (e) => {
        contact.name = e.target.value.trim();
      });
      tr.querySelector('.wa-te-edit-cluster').addEventListener('input', (e) => {
        contact.cluster = e.target.value.trim();
      });
      tr.querySelector('.wa-te-edit-phone').addEventListener('input', (e) => {
        contact.phone = e.target.value.trim();
      });

      tr.querySelector('.btn-wa-te-delete').addEventListener('click', () => {
        const currentList = [...(appStore.getState('waTeContacts') || [])];
        const actualIndex = currentList.indexOf(contact);
        if (actualIndex !== -1) {
          currentList.splice(actualIndex, 1);
          appStore.setState({ waTeContacts: currentList });
          renderTable(searchInput?.value || '');
        }
      });

      tbodyEl.appendChild(tr);
    }
  }

  async function loadContacts() {
    try {
      const contactsResponse = await tauriBridge.getWhatsAppTeContacts();
      const contacts = contactsResponse?.contacts || [];
      appStore.setState({ waTeContacts: contacts });
      renderTable(searchInput?.value || '');
      return contacts;
    } catch (err) {
      console.warn('Gagal memuat kontak TE:', err);
      return [];
    }
  }

  searchInput?.addEventListener('input', (e) => {
    renderTable(e.target.value);
  });

  btnClearSearch?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    renderTable('');
  });

  btnAdd?.addEventListener('click', () => {
    const currentContacts = appStore.getState('waTeContacts') || [];
    const result = addTeContact(currentContacts, {
      name: inputName?.value || '',
      cluster: inputCluster?.value || '',
      phone: inputPhone?.value || '',
    });

    if (!result.ok) {
      if (result.reason === 'missing_fields') {
        alert('Harap isi semua kolom Tambah Kontak!');
      } else {
        alert(result.message);
      }
      return;
    }

    appStore.setState({ waTeContacts: result.contacts });
    renderTable(searchInput?.value || '');

    if (inputName) inputName.value = '';
    if (inputCluster) inputCluster.value = '';
    if (inputPhone) inputPhone.value = '';
  });

  btnSave?.addEventListener('click', async () => {
    const oldText = btnSave.textContent;
    btnSave.disabled = true;
    btnSave.textContent = '⏳ Menyimpan...';

    try {
      const cleaned = compactTeContacts(appStore.getState('waTeContacts') || []);
      await tauriBridge.saveWhatsAppTeContacts(cleaned);
      appStore.setState({ waTeContacts: cleaned });
      renderTable(searchInput?.value || '');
      setStatus('✅ Database kontak TE berhasil disimpan!', 'text-grn', 3000);
    } catch (err) {
      alert(`Gagal menyimpan kontak: ${err}`);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = oldText || 'Simpan Perubahan';
    }
  });

  btnImport?.addEventListener('click', async () => {
    try {
      const selectedPath = await tauriBridge.pickDatabaseFile();
      if (!selectedPath) return;

      setStatus('Mengimpor data Excel...', 'text-amb', 0);
      await new Promise((r) => setTimeout(r, 50));

      const count = await tauriBridge.loadTeContactsExcel(selectedPath);
      setStatus(`✅ Berhasil mengimpor ${count} kontak TE!`, 'text-grn', 4000);
      await loadContacts();
    } catch (err) {
      alert(`Gagal mengimpor Excel: ${err}`);
      setStatus('', '');
    }
  });

  btnHandover?.addEventListener('click', () => {
    onOpenHandoverTe?.();
  });

  const offContactsUpdated = appStore.on('contacts:updated', () => {
    renderTable(searchInput?.value || '');
  });

  const offSubtabChanged = appStore.on('others:subtabChanged', ({ subtabId }) => {
    if (subtabId === 'subtab-wa-te') {
      loadContacts();
    }
  });

  return {
    loadContacts,
    renderTable,
    destroy: () => {
      offContactsUpdated();
      offSubtabChanged();
    },
  };
}
