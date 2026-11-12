/**
 * Attaches delegated multi-row selection (click, Ctrl/Cmd+click toggle, Shift+click range)
 * and optional Ctrl+C copy handling for table body elements.
 */
export function bindTableSelection(tbodyElement, {
  onCopySelected = null,
  isCopyShortcutActive = null,
} = {}) {
  if (!tbodyElement) {
    return {
      getSelectedRows: () => [],
      resetAnchor: () => {},
      destroy: () => {},
    };
  }

  let lastSelectedIndex = -1;

  function getRows() {
    return Array.from(tbodyElement.querySelectorAll('tr'));
  }

  function getSelectedRows() {
    return getRows().filter((row) => row.classList.contains('selected'));
  }

  function handleRowClick(event) {
    const clickedRow = event.target.closest('tr');
    if (!clickedRow || !tbodyElement.contains(clickedRow)) return;

    const rows = getRows();
    const rowIndex = rows.indexOf(clickedRow);
    if (rowIndex === -1) return;

    if (event.shiftKey && lastSelectedIndex !== -1) {
      const rangeStart = Math.min(lastSelectedIndex, rowIndex);
      const rangeEnd = Math.max(lastSelectedIndex, rowIndex);
      rows.forEach((row, index) => {
        if (index >= rangeStart && index <= rangeEnd) {
          row.classList.add('selected');
        }
      });
      document.getSelection?.()?.removeAllRanges();
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      clickedRow.classList.toggle('selected');
      lastSelectedIndex = rowIndex;
      return;
    }

    rows.forEach((row) => row.classList.remove('selected'));
    clickedRow.classList.add('selected');
    lastSelectedIndex = rowIndex;
  }

  async function handleCopyShortcut(event) {
    if (!onCopySelected) return;
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable)
    ) {
      return;
    }

    if (typeof isCopyShortcutActive === 'function' && !isCopyShortcutActive()) {
      return;
    }

    const selectedRows = getSelectedRows();
    if (selectedRows.length > 0) {
      await onCopySelected(selectedRows);
    }
  }

  tbodyElement.addEventListener('click', handleRowClick);
  document.addEventListener('keydown', handleCopyShortcut);

  return {
    getSelectedRows,
    resetAnchor() {
      lastSelectedIndex = -1;
    },
    destroy() {
      tbodyElement.removeEventListener('click', handleRowClick);
      document.removeEventListener('keydown', handleCopyShortcut);
    },
  };
}

