import { escapeHtml, getElementById, setTextContent } from '../../../shared/utils/dom-helpers.js';
import { flashTemporaryFeedback } from '../../../shared/utils/feedback.js';
import {
  loadMapTileConfig,
  resolveTileLayerSpecs,
  saveCartoApiKey,
  saveMapTileType,
} from '../logic/map-tile-config.js';
import {
  classifyDownSiteMarker,
  enrichNearestSites,
  resolveMapSearchTarget,
} from '../logic/map-sites-service.js';

function createPinIcon(Leaflet, tone, sizeClass = '') {
  const cls = ['map-pin', `map-pin--${tone}`, sizeClass].filter(Boolean).join(' ');
  const size = sizeClass === 'map-pin--lg' ? 16 : sizeClass === 'map-pin--sm' ? 12 : 14;
  return Leaflet.divIcon({
    className: 'map-leaflet-divicon',
    html: `<div class="${cls}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size / 2)],
  });
}

function buildPopupHtml({
  title,
  badgeLabel,
  badgeTone,
  lines = [],
  lat,
  lon,
  svTitle,
}) {
  const linesHtml = lines
    .filter(Boolean)
    .map((line) => `<div class="map-popup-line">${escapeHtml(line)}</div>`)
    .join('');

  return `
    <div class="map-popup-box">
      <div class="map-popup-header">
        <span>${escapeHtml(title)}</span>
        <span class="map-popup-badge map-popup-badge--${escapeHtml(badgeTone)}">${escapeHtml(badgeLabel)}</span>
      </div>
      ${linesHtml}
      <div class="map-popup-actions">
        <button
          type="button"
          class="tbtn-p map-popup-sv-btn"
          data-lat="${escapeHtml(lat)}"
          data-lon="${escapeHtml(lon)}"
          data-title="${escapeHtml(svTitle || title)}"
        >Street View</button>
      </div>
    </div>
  `;
}

/**
 * Mounts and controls the Leaflet Maps tab (`#tab-maps`), tile switching,
 * site/coordinate/geocoded search, 5 nearest BTS sidebar, down-site markers,
 * screenshot clipboard capture, and delegated Street View launches.
 */
export function mountMapsView({
  appStore,
  tauriBridge,
  storageAdapter,
  geocodingAdapter,
  clipboardAdapter,
  streetViewModal,
}) {
  const searchInput = getElementById('map-site-input');
  const btnSearch = getElementById('btn-map-search');
  const btnPlotDown = getElementById('btn-map-plot-down');
  const btnScreenshot = getElementById('btn-map-screenshot');
  const tileSelect = getElementById('map-tile-select');
  const cartoKeyWrap = getElementById('map-carto-key-wrap');
  const cartoKeyInput = getElementById('map-carto-key');
  const btnCartoSave = getElementById('btn-map-carto-save');
  const statusEl = getElementById('map-status');
  const mapContainer = getElementById('map-container');
  const loadingOverlay = getElementById('map-loading');
  const nearestPanel = getElementById('map-nearest-panel');
  const nearestTitleEl = getElementById('map-nearest-title');
  const nearestListEl = getElementById('map-nearest-list');
  const btnNearestClose = getElementById('btn-map-nearest-close');

  let siteMap = null;
  let activeTileLayers = [];
  let downLayerGroup = null;
  let nearestLayerGroup = null;

  function setMapLoading(isLoading) {
    if (!loadingOverlay) return;
    loadingOverlay.classList.toggle('hidden', !isLoading);
  }

  function isLightThemeActive() {
    const storeTheme = appStore?.getState?.('theme');
    if (storeTheme === 'light' || storeTheme === 'dark') {
      return storeTheme === 'light';
    }
    return document.body.classList.contains('light') ||
      document.body.classList.contains('light-mode') ||
      document.documentElement.getAttribute('data-theme') === 'light';
  }

  function syncCartoKeyVisibility(tileType) {
    if (!cartoKeyWrap) return;
    cartoKeyWrap.classList.toggle('hidden', tileType !== 'carto');
  }

  function applyTileLayers() {
    if (!siteMap || typeof L === 'undefined') return;

    const config = loadMapTileConfig(storageAdapter);
    const specs = resolveTileLayerSpecs({
      tileType: config.tileType,
      isLight: isLightThemeActive(),
      cartoApiKey: config.cartoApiKey,
    });

    for (const layer of activeTileLayers) {
      siteMap.removeLayer(layer);
    }
    activeTileLayers = [];

    for (const spec of specs) {
      const layer = L.tileLayer(spec.url, spec.options);
      layer.addTo(siteMap);
      activeTileLayers.push(layer);
    }
  }

  function ensureMapInitialized() {
    if (siteMap) return siteMap;
    if (!mapContainer || typeof L === 'undefined') return null;

    siteMap = L.map(mapContainer, {
      center: [-7.15, 110.14],
      zoom: 9,
      preferCanvas: true,
    });

    downLayerGroup = L.layerGroup().addTo(siteMap);
    nearestLayerGroup = L.layerGroup().addTo(siteMap);

    // Single delegated listener handles Street View clicks inside any Leaflet popup.
    siteMap.on('popupopen', (event) => {
      const popupEl = event?.popup?.getElement?.();
      if (!popupEl) return;

      const svBtn = popupEl.querySelector('.map-popup-sv-btn');
      if (!svBtn || svBtn.dataset.svBound === '1') return;
      svBtn.dataset.svBound = '1';

      svBtn.addEventListener('click', () => {
        const lat = Number(svBtn.dataset.lat);
        const lon = Number(svBtn.dataset.lon);
        const title = svBtn.dataset.title || '';
        streetViewModal?.open(lat, lon, title);
      });
    });

    applyTileLayers();
    return siteMap;
  }

  function restoreTilePreferences() {
    const config = loadMapTileConfig(storageAdapter);
    if (tileSelect) {
      tileSelect.value = config.tileType;
    }
    if (cartoKeyInput) {
      cartoKeyInput.value = config.cartoApiKey;
    }
    syncCartoKeyVisibility(config.tileType);
  }

  function renderNearestSidebar(targetTitle, enrichedSites, markerBySiteId) {
    if (!nearestPanel || !nearestListEl) return;

    setTextContent(nearestTitleEl, `5 Nearest BTS — ${targetTitle}`);
    nearestListEl.replaceChildren();

    for (const site of enrichedSites) {
      const siteId = String(site.site_id || site.new_site || '-');
      const siteName = String(site.site_name || '-');
      const distKm = Number(site.distance_km);
      const distLabel = Number.isFinite(distKm) ? `${distKm.toFixed(2)} km` : '—';
      const statusLabel = site.isDown
        ? `DOWN (${site.downData?.remark || site.downData?.impact || 'Alarm'})`
        : 'UP / Normal';

      const card = document.createElement('div');
      card.className = `map-nearest-card ${site.isDown ? 'map-nearest-card--down' : 'map-nearest-card--up'}`;
      card.innerHTML = `
        <div class="map-nearest-card-top">
          <span class="map-nearest-site-id">${escapeHtml(siteId)}</span>
          <span class="map-nearest-dist">${escapeHtml(distLabel)}</span>
        </div>
        <div class="map-nearest-name">${escapeHtml(siteName)}</div>
        <div class="map-nearest-meta">
          <span>${escapeHtml(statusLabel)}</span>
          <button type="button" class="tbtn-p map-nearest-sv-btn">Street View</button>
        </div>
      `;

      const svButton = card.querySelector('.map-nearest-sv-btn');
      svButton?.addEventListener('click', (evt) => {
        evt.stopPropagation();
        streetViewModal?.open(site.lat, site.lon, `${siteId} — ${siteName}`);
      });

      card.addEventListener('click', () => {
        const map = ensureMapInitialized();
        if (!map) return;
        const marker = markerBySiteId.get(siteId);
        map.flyTo([site.lat, site.lon], 15, { duration: 0.45 });
        marker?.openPopup();
      });

      nearestListEl.appendChild(card);
    }

    nearestPanel.classList.remove('hidden');
  }

  async function handleSearch() {
    const query = searchInput?.value?.trim() || '';
    if (!query) {
      setTextContent(statusEl, 'Masukkan Site ID, koordinat (lat, lon), atau nama lokasi.');
      return;
    }

    const map = ensureMapInitialized();
    if (!map) {
      setTextContent(statusEl, 'Leaflet map library belum tersedia.');
      return;
    }

    setMapLoading(true);
    setTextContent(statusEl, `Mencari "${query}"...`);

    try {
      const target = await resolveMapSearchTarget(query, {
        lookupSite: (siteId) => tauriBridge.lookupSite(siteId),
        geocode: (q) => geocodingAdapter.searchLocation(q),
      });

      if (!target) {
        setTextContent(statusEl, `Lokasi/Site "${query}" tidak ditemukan atau koordinat tidak valid.`);
        return;
      }

      nearestLayerGroup.clearLayers();
      const boundsPoints = [[target.lat, target.lon]];
      const targetMarker = L.marker([target.lat, target.lon], {
        icon: createPinIcon(L, 'target', 'map-pin--lg'),
      }).addTo(nearestLayerGroup);

      targetMarker.bindPopup(
        buildPopupHtml({
          title: target.title,
          badgeLabel: target.isSite ? 'TARGET SITE' : 'TARGET COORD',
          badgeTone: 'target',
          lines: [`Coord: ${target.lat.toFixed(6)}, ${target.lon.toFixed(6)}`],
          lat: target.lat,
          lon: target.lon,
          svTitle: target.title,
        })
      );

      const nearestRaw = await tauriBridge.findNearestSites({
        lat: target.lat,
        lon: target.lon,
        limit: 5,
      });

      const statusData = appStore?.getState?.('statusData') || [];
      const enriched = enrichNearestSites(nearestRaw || [], statusData);
      const markerBySiteId = new Map();

      for (const site of enriched) {
        const lat = Number(site.lat);
        const lon = Number(site.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        boundsPoints.push([lat, lon]);
        const siteId = String(site.site_id || site.new_site || '-');
        const siteName = String(site.site_name || '-');
        const tone = site.isDown ? 'down' : 'up';
        const marker = L.marker([lat, lon], {
          icon: createPinIcon(L, tone),
        }).addTo(nearestLayerGroup);

        marker.bindPopup(
          buildPopupHtml({
            title: `${siteId} — ${siteName}`,
            badgeLabel: site.isDown ? 'DOWN' : 'UP',
            badgeTone: tone,
            lines: [
              Number.isFinite(Number(site.distance_km))
                ? `Jarak: ${Number(site.distance_km).toFixed(2)} km`
                : '',
              site.cluster ? `Cluster: ${site.cluster}` : '',
              site.te_pic ? `TE PIC: ${site.te_pic}` : '',
              site.downData?.remark ? `Remark: ${site.downData.remark}` : '',
            ],
            lat,
            lon,
            svTitle: `${siteId} — ${siteName}`,
          })
        );

        markerBySiteId.set(siteId, marker);
      }

      if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [45, 45], maxZoom: 15 });
      } else {
        map.setView([target.lat, target.lon], 14);
      }

      targetMarker.openPopup();
      renderNearestSidebar(target.title, enriched, markerBySiteId);
      setTextContent(
        statusEl,
        `Ditemukan ${enriched.length} BTS terdekat di sekitar ${target.title}.`
      );
    } catch (err) {
      setTextContent(statusEl, `Gagal mencari lokasi: ${err?.message || err}`);
    } finally {
      setMapLoading(false);
    }
  }

  async function handlePlotDownSites() {
    const map = ensureMapInitialized();
    if (!map) {
      setTextContent(statusEl, 'Leaflet map library belum tersedia.');
      return;
    }

    setMapLoading(true);
    setTextContent(statusEl, 'Mengambil koordinat site down...');

    try {
      const coords = await tauriBridge.getDownSitesCoordinates();
      downLayerGroup.clearLayers();

      const validPoints = [];
      for (const site of coords || []) {
        const lat = Number(site.lat);
        const lon = Number(site.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0) continue;

        validPoints.push([lat, lon]);
        const { typeLabel, tone } = classifyDownSiteMarker(site);
        const siteId = String(site.site_id || site.new_site || '-');
        const siteName = String(site.site_name || '-');

        const marker = L.marker([lat, lon], {
          icon: createPinIcon(L, tone, 'map-pin--sm'),
        }).addTo(downLayerGroup);

        marker.bindPopup(
          buildPopupHtml({
            title: `${siteId} — ${siteName}`,
            badgeLabel: typeLabel,
            badgeTone: tone,
            lines: [
              site.cluster ? `Cluster: ${site.cluster}` : '',
              site.te_pic ? `TE PIC: ${site.te_pic}` : '',
              site.impact ? `Impact: ${site.impact}` : '',
              site.remark ? `Remark: ${site.remark}` : '',
            ],
            lat,
            lon,
            svTitle: `${siteId} — ${siteName}`,
          })
        );
      }

      if (validPoints.length > 0) {
        map.fitBounds(validPoints, { padding: [36, 36], maxZoom: 13 });
        setTextContent(statusEl, `Menampilkan ${validPoints.length} site/cell down di peta.`);
      } else {
        setTextContent(statusEl, 'Tidak ada site down berkoordinat valid untuk ditampilkan.');
      }
    } catch (err) {
      setTextContent(statusEl, `Gagal plot down sites: ${err?.message || err}`);
    } finally {
      setMapLoading(false);
    }
  }

  async function handleScreenshot() {
    if (typeof html2canvas !== 'function') {
      setTextContent(statusEl, 'Library html2canvas belum siap untuk screenshot peta.');
      return;
    }

    const map = ensureMapInitialized();
    if (!map || !mapContainer) return;

    setMapLoading(true);
    setTextContent(statusEl, 'Menyiapkan screenshot peta ke clipboard...');

    try {
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Gagal membuat PNG blob dari canvas peta.');
      }

      await clipboardAdapter.writeImageBlob(blob, 'image/png');
      flashTemporaryFeedback(btnScreenshot, '✓ Copied PNG', { activeClass: 'ok' });
      setTextContent(statusEl, 'Screenshot peta berhasil disalin ke clipboard.');
    } catch (err) {
      setTextContent(statusEl, `Screenshot gagal: ${err?.message || err}`);
    } finally {
      setMapLoading(false);
    }
  }

  function handleTileSelectChange() {
    const nextType = tileSelect?.value || 'auto';
    saveMapTileType(storageAdapter, nextType);
    syncCartoKeyVisibility(nextType);
    applyTileLayers();
  }

  function handleCartoKeySave() {
    saveCartoApiKey(storageAdapter, cartoKeyInput?.value || '');
    applyTileLayers();
    flashTemporaryFeedback(btnCartoSave, 'Saved ✓', { activeClass: 'ok' });
  }

  function handleTabActivated(targetTabId) {
    if (targetTabId !== 'tab-maps') return;
    const map = ensureMapInitialized();
    if (!map) return;

    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 150);
  }

  restoreTilePreferences();

  btnSearch?.addEventListener('click', handleSearch);
  searchInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') handleSearch();
  });
  btnPlotDown?.addEventListener('click', handlePlotDownSites);
  btnScreenshot?.addEventListener('click', handleScreenshot);
  tileSelect?.addEventListener('change', handleTileSelectChange);
  btnCartoSave?.addEventListener('click', handleCartoKeySave);
  cartoKeyInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') handleCartoKeySave();
  });
  btnNearestClose?.addEventListener('click', () => {
    nearestPanel?.classList.add('hidden');
  });

  const offNav = appStore?.on?.('navigation:changed', ({ targetTabId } = {}) => {
    handleTabActivated(targetTabId);
  }) || (() => {});
  const offThemeEvent = appStore?.on?.('theme:changed', () => applyTileLayers()) || (() => {});
  const unsubscribeTheme = appStore?.subscribe?.('theme', () => applyTileLayers()) || (() => {});

  return {
    plotDownSites: handlePlotDownSites,
    searchMap: handleSearch,
    invalidateSize: () => siteMap?.invalidateSize?.(),
    destroy() {
      btnSearch?.removeEventListener('click', handleSearch);
      btnPlotDown?.removeEventListener('click', handlePlotDownSites);
      btnScreenshot?.removeEventListener('click', handleScreenshot);
      tileSelect?.removeEventListener('change', handleTileSelectChange);
      btnCartoSave?.removeEventListener('click', handleCartoKeySave);
      offNav();
      offThemeEvent();
      unsubscribeTheme();
      siteMap?.remove?.();
      siteMap = null;
    },
  };
}
