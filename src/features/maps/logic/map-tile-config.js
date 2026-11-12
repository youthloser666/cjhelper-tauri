import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';

/**
 * Loads saved map tile provider and CARTO API key preferences.
 *
 * @param {{ getString: (key: string, fallback?: string) => string }} storage
 * @returns {{ tileType: string, cartoApiKey: string }}
 */
export function loadMapTileConfig(storage) {
  const tileType = storage?.getString?.(STORAGE_KEYS.MAP_TILE_TYPE, 'auto') || 'auto';
  const cartoApiKey = storage?.getString?.(STORAGE_KEYS.CARTO_API_KEY, '') || '';
  return { tileType, cartoApiKey };
}

/**
 * Persists the selected map tile provider preset.
 *
 * @param {{ setString: (key: string, value: string) => void }} storage
 * @param {string} tileType
 */
export function saveMapTileType(storage, tileType) {
  storage?.setString?.(STORAGE_KEYS.MAP_TILE_TYPE, tileType || 'auto');
}

/**
 * Persists or clears the user's CARTO basemap API key.
 *
 * @param {{ setString: (key: string, value: string) => void, remove: (key: string) => void }} storage
 * @param {string} key
 */
export function saveCartoApiKey(storage, key) {
  const trimmed = String(key ?? '').trim();
  if (!trimmed) {
    storage?.remove?.(STORAGE_KEYS.CARTO_API_KEY);
    return;
  }
  storage?.setString?.(STORAGE_KEYS.CARTO_API_KEY, trimmed);
}

/**
 * Resolves the Leaflet tile layer specifications for the requested provider and theme.
 *
 * @param {{ tileType?: string, isLight?: boolean, cartoApiKey?: string }} params
 * @returns {Array<{ url: string, options: Record<string, unknown> }>}
 */
export function resolveTileLayerSpecs({ tileType = 'auto', isLight = false, cartoApiKey = '' } = {}) {
  const normalizedType = String(tileType || 'auto').toLowerCase();
  const trimmedKey = String(cartoApiKey || '').trim();

  if (normalizedType === 'satellite') {
    return [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19,
        },
      },
    ];
  }

  if (normalizedType === 'carto' && trimmedKey) {
    const cartoStyle = isLight ? 'light_all' : 'dark_all';
    return [
      {
        url: `https://{s}.basemaps.cartocdn.com/${cartoStyle}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(trimmedKey)}`,
        options: {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        },
      },
    ];
  }

  const shouldUseOsm = normalizedType === 'osm' || (normalizedType !== 'dark' && isLight);
  if (shouldUseOsm) {
    return [
      {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        },
      },
    ];
  }

  return [
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 16,
      },
    },
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 16,
      },
    },
  ];
}

