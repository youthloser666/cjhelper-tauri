export const CJN_REGION_KEYWORDS = Object.freeze([
  'SEMARANG',
  'DEMAK',
  'KUDUS',
  'PATI',
  'JEPARA',
  'GROBOGAN',
  'BLORA',
  'REMBANG',
  'PEKALONGAN',
  'BATANG',
  'PEMALANG',
  'TEGAL',
  'BREBES',
  'KENDAL',
]);

export const CJS_REGION_KEYWORDS = Object.freeze([
  'SOLO',
  'SURAKARTA',
  'BOYOLALI',
  'SUKOHARJO',
  'KARANGANYAR',
  'WONOGIRI',
  'SRAGEN',
  'KLATEN',
  'MAGELANG',
  'PURWOREJO',
  'TEMANGGUNG',
  'WONOSOBO',
  'KEBUMEN',
  'BANYUMAS',
  'PURWOKERTO',
  'CILACAP',
  'PURBALINGGA',
  'BANJARNEGARA',
]);

/**
 * Resolves Central Java operating region ("CJN" or "CJS") from explicit region
 * markers first, followed by cluster, site name, remark, area, ROH, and PIC text.
 */
export function detectRegion(siteOrContext) {
  if (!siteOrContext || typeof siteOrContext !== 'object') {
    return 'CJN';
  }

  const combinedText = [
    siteOrContext.rawRegion,
    siteOrContext.roh,
    siteOrContext.area,
    siteOrContext.areaName,
    siteOrContext.cluster,
    siteOrContext.siteName,
    siteOrContext.site_name,
    siteOrContext.remark,
    siteOrContext.pic,
    siteOrContext.siteId,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (combinedText.includes('CJS') || combinedText.includes('SOUTH')) {
    return 'CJS';
  }
  if (combinedText.includes('CJN') || combinedText.includes('NORTH')) {
    return 'CJN';
  }
  if (CJN_REGION_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return 'CJN';
  }
  if (CJS_REGION_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return 'CJS';
  }

  return 'CJN';
}

