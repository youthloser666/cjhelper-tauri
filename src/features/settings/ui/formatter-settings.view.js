import { bindSegmentedControl } from '../../../shared/ui/segmented-control.js';
import { getElementById, setTextContent } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import {
  buildFormatterPreview,
  loadFormatterSettings,
  resetFormatterTarget,
  saveFormatterTarget,
  serializeFormatterForm,
} from '../logic/formatter-settings-service.js';

/**
 * Mounts and controls the Formatting Editor subtab (`#subtab-fmt`).
 * Keeps `appStore` (`fmtMsg`, `fmtBc`) and `storageAdapter` synchronized on save/reset.
 */
export function mountFormatterSettingsView({ appStore, storageAdapter }) {
  const targetSeg = getElementById('fmt-target-seg');
  const lineInput = getElementById('fmt-line');
  const remarkInput = getElementById('fmt-remark');
  const hdrInput = getElementById('fmt-hdr');
  const lblSdInput = getElementById('fmt-lbl-sd');
  const lblCdInput = getElementById('fmt-lbl-cd');
  const lblBcchInput = getElementById('fmt-lbl-bcch');
  const keyBcchInput = getElementById('fmt-key-bcch');
  const iconDownInput = getElementById('fmt-icon-down');
  const spacingChk = getElementById('fmt-spacing-chk');
  const previewBox = getElementById('fmt-preview-box');
  const statusMsg = getElementById('fmt-status-msg');
  const btnSave = getElementById('btn-fmt-save');
  const btnReset = getElementById('btn-fmt-reset');

  let activeTarget = 'msg';

  function readFormValues() {
    return serializeFormatterForm(
      {
        msg_line: lineInput?.value,
        msg_remark: remarkInput?.value,
        msg_hdr: hdrInput?.value,
        lbl_sd: lblSdInput?.value,
        lbl_cd: lblCdInput?.value,
        lbl_bcch: lblBcchInput?.value,
        key_bcch: keyBcchInput?.value,
        icon_down: iconDownInput?.value,
        spacing: spacingChk?.checked,
      },
      activeTarget
    );
  }

  function writeFormValues(config) {
    if (lineInput) lineInput.value = config.msg_line ?? '';
    if (remarkInput) remarkInput.value = config.msg_remark ?? '';
    if (hdrInput) hdrInput.value = config.msg_hdr ?? '';
    if (lblSdInput) lblSdInput.value = config.lbl_sd ?? '';
    if (lblCdInput) lblCdInput.value = config.lbl_cd ?? '';
    if (lblBcchInput) lblBcchInput.value = config.lbl_bcch ?? '';
    if (keyBcchInput) keyBcchInput.value = config.key_bcch ?? '';
    if (iconDownInput) iconDownInput.value = config.icon_down ?? '';
    if (spacingChk) spacingChk.checked = Boolean(config.spacing);
  }

  function updatePreview() {
    if (!previewBox) return;
    previewBox.textContent = buildFormatterPreview(readFormValues(), activeTarget);
  }

  function syncStoreFromStorage() {
    const settings = loadFormatterSettings(storageAdapter);
    appStore?.setState?.({
      fmtMsg: settings.msg,
      fmtBc: settings.bc,
    });
    return settings;
  }

  function loadTargetIntoForm(target) {
    activeTarget = target === 'bc' ? 'bc' : 'msg';
    const settings = syncStoreFromStorage();
    writeFormValues(settings[activeTarget]);
    updatePreview();
  }

  function handleSave() {
    const saved = saveFormatterTarget(storageAdapter, activeTarget, readFormValues());
    if (activeTarget === 'bc') {
      appStore?.setState?.({ fmtBc: saved });
    } else {
      appStore?.setState?.({ fmtMsg: saved });
    }
    appStore?.emit?.('format:updated', { target: activeTarget, config: saved });
    flashTemporaryFeedback(statusMsg, '✓ Format saved', { durationMs: 2200 });
    flashTemporaryFeedback(btnSave, 'Saved ✓', { durationMs: 1800, activeClass: 'ok' });
  }

  function handleReset() {
    const defaults = resetFormatterTarget(storageAdapter, activeTarget);
    if (activeTarget === 'bc') {
      appStore?.setState?.({ fmtBc: defaults });
    } else {
      appStore?.setState?.({ fmtMsg: defaults });
    }
    writeFormValues(defaults);
    updatePreview();
    appStore?.emit?.('format:updated', { target: activeTarget, config: defaults });
    setTextContent(statusMsg, 'Reset to default template.');
    setTimeout(() => setTextContent(statusMsg, ''), 2200);
  }

  const formInputs = [
    lineInput,
    remarkInput,
    hdrInput,
    lblSdInput,
    lblCdInput,
    lblBcchInput,
    keyBcchInput,
    iconDownInput,
  ].filter(Boolean);

  for (const input of formInputs) {
    input.addEventListener('input', updatePreview);
  }
  spacingChk?.addEventListener('change', updatePreview);
  btnSave?.addEventListener('click', handleSave);
  btnReset?.addEventListener('click', handleReset);

  const unbindSeg = bindSegmentedControl(targetSeg, (selectedTarget) => {
    loadTargetIntoForm(selectedTarget);
  });

  loadTargetIntoForm('msg');

  return {
    reload: () => loadTargetIntoForm(activeTarget),
    destroy() {
      unbindSeg();
      for (const input of formInputs) {
        input.removeEventListener('input', updatePreview);
      }
      spacingChk?.removeEventListener('change', updatePreview);
      btnSave?.removeEventListener('click', handleSave);
      btnReset?.removeEventListener('click', handleReset);
    },
  };
}

