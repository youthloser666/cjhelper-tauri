/**
 * Normalizes coordinate numbers and display labels for the Street View modal.
 *
 * @param {number | string} lat
 * @param {number | string} lon
 * @param {string} [title]
 * @returns {{ lat: number, lon: number, title: string, coordsLabel: string } | null}
 */
export function normalizeStreetViewCoords(lat, lon, title = '') {
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return null;

  const coordsLabel = `${nLat.toFixed(6)}, ${nLon.toFixed(6)}`;
  const resolvedTitle = String(title ?? '').trim() || coordsLabel;
  return {
    lat: nLat,
    lon: nLon,
    title: resolvedTitle,
    coordsLabel,
  };
}

/**
 * Builds the Google Maps Street View panorama or satellite embed iframe URL.
 *
 * @param {number | string} lat
 * @param {number | string} lon
 * @param {'pano' | 'sat'} [mode]
 * @returns {string}
 */
export function buildStreetViewEmbedUrl(lat, lon, mode = 'pano') {
  if (mode === 'sat') {
    return `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=19&output=embed`;
  }
  return `https://www.google.com/maps/embed?origin=mfe&pb=!6m8!1m7!1s!2m2!1d${lat}!2d${lon}!3m2!1f0!2f90!4f75`;
}

/**
 * Builds an external Google Maps Street View URL suitable for opening in the OS browser.
 *
 * @param {number | string} lat
 * @param {number | string} lon
 * @returns {string}
 */
export function buildExternalStreetViewUrl(lat, lon) {
  return `http://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}`;
}

