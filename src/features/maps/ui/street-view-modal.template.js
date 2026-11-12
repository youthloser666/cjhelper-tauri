/**
 * Renders the Street View & Satellite preview modal (`#modal-street-view`) markup.
 * Uses only the base `.modal` class (without `.hidden`) so `createModalController` controls visibility via `.open`.
 */
export function renderStreetViewModal() {
  return `
    <div id="modal-street-view" class="modal">
      <div class="modal-card-sv">
        <div class="modal-header-row">
          <div>
            <span id="sv-modal-title" class="modal-h3-accent">Street View</span>
            <span id="sv-modal-coords" class="sv-coords-label"></span>
          </div>
          <button type="button" id="btn-sv-close" class="tbtn-clr modal-close-xs modal-close-trigger">✕</button>
        </div>

        <div class="sv-controls-row">
          <div id="sv-mode-group" class="segmented-control">
            <button type="button" id="sv-mode-pano" class="seg-btn active" data-val="pano">Street View</button>
            <button type="button" id="sv-mode-sat" class="seg-btn" data-val="sat">Satellite View</button>
          </div>
          <button type="button" id="btn-sv-open-external" class="tbtn-p">Open in Browser ↗</button>
        </div>

        <div class="sv-iframe-wrap">
          <iframe
            id="sv-iframe"
            class="sv-iframe"
            title="Street View Preview"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
          ></iframe>
          <div id="sv-iframe-loader" class="sv-iframe-overlay hidden">
            Memuat tampilan Street View...
          </div>
          <div id="sv-iframe-error" class="sv-iframe-overlay hidden">
            <span>Preview embed tidak tersedia untuk koordinat ini.</span>
            <button type="button" id="btn-sv-error-external" class="tbtn-p">Buka di Google Maps Browser ↗</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

