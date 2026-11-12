/**
 * Renders the Leaflet Maps tab (`#tab-maps`) markup with zero inline styles.
 */
export function renderMapsTab() {
  return `
    <div id="tab-maps" class="tab-pane hidden">
      <div class="t-card flex-1 flex-col">
        <div class="t-card-head">
          <span class="t-card-title">Site &amp; Nearest BTS Map</span>
          <div class="flex-row gap-6">
            <button type="button" class="tbtn-a" id="btn-map-plot-down">Plot Down Sites</button>
            <button type="button" class="tbtn-p" id="btn-map-screenshot">Screenshot Map</button>
          </div>
        </div>

        <div class="map-toolbar">
          <input
            type="text"
            class="sinput map-search-input"
            id="map-site-input"
            placeholder="Cari Site ID, Koordinat (lat, lon), atau Alamat..."
          />
          <button type="button" class="tbtn-p" id="btn-map-search">Search &amp; Nearest BTS</button>

          <div class="map-tile-group">
            <label for="map-tile-select" class="map-tile-label">Basemap:</label>
            <select id="map-tile-select" class="fi map-tile-select">
              <option value="auto">Auto (Follow Theme)</option>
              <option value="osm">OSM Light</option>
              <option value="dark">Esri Dark Gray</option>
              <option value="satellite">Esri Satellite</option>
              <option value="carto">CARTO Basemap</option>
            </select>
          </div>

          <div id="map-carto-key-wrap" class="map-carto-key-wrap hidden">
            <input
              type="password"
              id="map-carto-key"
              class="fi map-carto-key-input"
              placeholder="CARTO API Key..."
            />
            <button type="button" id="btn-map-carto-save" class="tbtn-a">Save Key</button>
          </div>
        </div>

        <div class="map-status-bar">
          <span id="map-status" class="map-status-text">Ready — cari Site ID / koordinat atau klik Plot Down Sites.</span>
          <div class="map-legend">
            <span class="map-legend-item"><span class="map-legend-dot map-legend-dot--down"></span>Site Down</span>
            <span class="map-legend-item"><span class="map-legend-dot map-legend-dot--bcch"></span>BCCH Down</span>
            <span class="map-legend-item"><span class="map-legend-dot map-legend-dot--cell"></span>Cells Down</span>
            <span class="map-legend-item"><span class="map-legend-dot map-legend-dot--up"></span>Nearest BTS (UP)</span>
            <span class="map-legend-item"><span class="map-legend-dot map-legend-dot--target"></span>Target Point</span>
          </div>
        </div>

        <div id="map-canvas-wrap" class="map-workspace">
          <div id="map-container" class="map-canvas"></div>

          <div id="map-loading" class="map-loading-overlay hidden">
            Memuat data peta &amp; koordinat...
          </div>

          <div id="map-nearest-panel" class="map-nearest-panel hidden">
            <div class="map-nearest-header">
              <span id="map-nearest-title" class="map-nearest-title">5 Nearest BTS</span>
              <button type="button" id="btn-map-nearest-close" class="tbtn-clr modal-close-xs">✕</button>
            </div>
            <div id="map-nearest-list" class="map-nearest-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

