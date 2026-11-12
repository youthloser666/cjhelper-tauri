/**
 * Copies plain text or PNG image blobs to the system clipboard cleanly.
 */
export function createClipboardAdapter({
  clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null,
  ClipboardItemCtor = typeof ClipboardItem !== 'undefined' ? ClipboardItem : null,
  logger = console,
} = {}) {
  async function writeText(text) {
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      return false;
    }

    try {
      await clipboard.writeText(String(text ?? ''));
      return true;
    } catch (error) {
      logger?.warn?.('[clipboard] Failed to write text:', error);
      return false;
    }
  }

  async function writeImageBlob(blob, mimeType = 'image/png') {
    if (
      !blob ||
      !clipboard ||
      typeof clipboard.write !== 'function' ||
      typeof ClipboardItemCtor !== 'function'
    ) {
      return false;
    }

    try {
      const item = new ClipboardItemCtor({ [mimeType]: blob });
      await clipboard.write([item]);
      return true;
    } catch (error) {
      logger?.warn?.('[clipboard] Failed to write image blob:', error);
      return false;
    }
  }

  return {
    writeText,
    writeImageBlob,
  };
}

export const clipboardAdapter = createClipboardAdapter();

