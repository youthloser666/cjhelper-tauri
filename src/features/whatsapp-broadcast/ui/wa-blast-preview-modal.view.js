import { createModalController } from '../../../shared/ui/modal-controller.js';
import { getElementById } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';

/**
 * Controls the per-TE WhatsApp message preview modal (`#wa-blast-preview-modal`).
 */
export function mountWaBlastPreviewModalView({ clipboardAdapter }) {
  const modalEl = getElementById('wa-blast-preview-modal');
  const lblName = getElementById('lbl-preview-te-name');
  const lblPhone = getElementById('lbl-preview-te-phone');
  const txtMsg = getElementById('txt-preview-te-msg');
  const copyBtn = getElementById('btn-copy-preview-te-msg');
  const doneBtn = getElementById('btn-done-preview-te');
  const closeBtn = getElementById('btn-close-wa-blast-preview');

  const modalController = createModalController(modalEl, {
    closeButtonSelector: '#btn-close-wa-blast-preview, #btn-done-preview-te',
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modalController.close('close-button'));
  }
  if (doneBtn) {
    doneBtn.addEventListener('click', () => modalController.close('done-button'));
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const value = txtMsg?.value || '';
      if (!value) return;
      await clipboardAdapter.writeText(value);
      flashTemporaryFeedback(copyBtn, '✓ Copied!');
    });
  }

  function open({ name, cluster, phone, message }) {
    if (lblName) lblName.textContent = `${name} (${cluster})`;
    if (lblPhone) lblPhone.textContent = phone ? `[${phone}]` : '[WA Phone unset]';
    if (txtMsg) {
      txtMsg.value = message || '(No data to send based on current filter configuration)';
    }
    modalController.open();
  }

  return {
    open,
    close: () => modalController.close(),
  };
}

