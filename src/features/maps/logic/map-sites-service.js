/**
 * Parses `"lat, lon"` text input into validated geographic coordinates.
 * Rejects `(0, 0)` placeholder coordinates and out-of-range inputs.
 *
 * @param {string} raw
 * @returns {{ lat: number, lon: number } | null}
 */
export function parseCoordinateInput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || !trimmed.includes(',')) return null;
  const parts = trimmed.split(',');
  if (parts.length !== 2) return null;

  const latRaw = parts[0].trim();
  const lonRaw = parts[1].trim();
  if (!latRaw || !lonRaw) return null;

  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

/**
 * Classifies a down-site coordinate entry into a marker label and visual tone.
 *
 * @param {{ impact?: string, remark?: string }} site
 * @returns {{ typeLabel: 'SITE DOWN' | 'CELLS DOWN', tone: 'down' | 'bcch' | 'cell' }}
 */
export function classifyDownSiteMarker(site) {
  const impact = String(site?.impact || '').trim();
  const remark = String(site?.remark || '').trim();
  const isCellsOnly = /partial|cell/i.test(impact) && !/fully\s*down/i.test(impact);

  if (!isCellsOnly) {
    return { typeLabel: 'SITE DOWN', tone: 'down' };
  }

  const isBcch = /bcch/i.test(remark);
  return {
    typeLabel: 'CELLS DOWN',
    tone: isBcch ? 'bcch' : 'cell',
  };
}

/**
 * Merges active status alarm metadata onto nearest-BTS search results.
 *
 * @param {Array<Record<string, unknown>>} nearestSites
 * @param {Array<Record<string, unknown>>} statusData
 * @returns {Array<Record<string, unknown>>}
 */
export function enrichNearestSites(nearestSites = [], statusData = []) {
  const statusMap = new Map();
  for (const row of statusData || []) {
    const key = String(row?.new_site || row?.site_id || '').trim().toUpperCase();
    if (key && !statusMap.has(key)) {
      statusMap.set(key, row);
    }
  }

  return (nearestSites || []).map((site) => {
    const siteKey = String(site?.site_id || site?.new_site || '').trim().toUpperCase();
    const downData = siteKey ? statusMap.get(siteKey) || null : null;
    return {
      ...site,
      downData,
      isDown: Boolean(downData),
    };
  });
}

/**
 * Resolves a map search input (coordinates, Site ID in Master DB, or geocoded place name).
 *
 * @param {string} query
 * @param {{ lookupSite?: (siteId: string) => Promise<Record<string, unknown> | null>, geocode?: (query: string) => Promise<Array<Record<string, unknown>>> }} handlers
 * @returns {Promise<{ lat: number, lon: number, title: string, isSite: boolean, site?: Record<string, unknown> } | null>}
 */
export async function resolveMapSearchTarget(query, { lookupSite, geocode } = {}) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return null;

  const parsedCoords = parseCoordinateInput(trimmed);
  if (parsedCoords) {
    return {
      lat: parsedCoords.lat,
      lon: parsedCoords.lon,
      title: trimmed,
      isSite: false,
    };
  }

  if (typeof lookupSite === 'function') {
    const site = await lookupSite(trimmed);
    if (site) {
      const lat = Number(site.Latitude ?? site.lat);
      const lon = Number(site.Longitude ?? site.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0) {
        return {
          lat,
          lon,
          title: String(site['Site Name'] || site.site_name || trimmed).trim(),
          isSite: true,
          site,
        };
      }
    }
  }

  if (typeof geocode === 'function') {
    const geoResults = await geocode(trimmed);
    if (Array.isArray(geoResults) && geoResults.length > 0) {
      const first = geoResults[0];
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return {
          lat,
          lon,
          title: String(first.display_name || trimmed).trim(),
          isSite: false,
        };
      }
    }
  }

  return null;
}

