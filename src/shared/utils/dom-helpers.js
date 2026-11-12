/**
 * Safe DOM element lookup and manipulation helpers for UI view modules.
 */
export function getElementById(elementId, root = document) {
  return root.getElementById(elementId);
}

export function querySelector(selector, root = document) {
  return root.querySelector(selector);
}

export function querySelectorAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function setTextContent(targetOrId, textValue, root = document) {
  const element = typeof targetOrId === 'string'
    ? getElementById(targetOrId, root)
    : targetOrId;
  if (!element) return null;

  element.textContent = textValue === undefined || textValue === null ? '' : String(textValue);
  return element;
}

export function toggleHidden(targetOrId, isHidden, root = document) {
  const element = typeof targetOrId === 'string'
    ? getElementById(targetOrId, root)
    : targetOrId;
  if (!element) return null;

  element.classList.toggle('is-hidden', Boolean(isHidden));
  return element;
}

export function escapeHtml(rawValue) {
  return String(rawValue ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

