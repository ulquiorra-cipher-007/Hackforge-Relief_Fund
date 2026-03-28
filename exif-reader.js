/**
 * js/exif-reader.js
 *
 * Converts raw EXIF GPS tags into a { lat, lon } decimal object.
 * This module has no dependencies — it receives the parsed EXIF object
 * from exifr (loaded in geotag.js) and does pure maths.
 *
 * Export:
 *   extractGPS(exifData) → { lat: number, lon: number } | null
 */

/**
 * Convert a GPS degrees-minutes-seconds array to decimal degrees.
 * EXIF stores values as [degrees, minutes, seconds] — all positive numbers.
 * The hemisphere ref (N/S/E/W) determines the sign.
 *
 * @param {number[]} dms   - [degrees, minutes, seconds]
 * @param {string}   ref   - "N" | "S" | "E" | "W"
 * @returns {number|null}
 */
function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;

  const [deg, min, sec] = dms;
  if (typeof deg !== "number" || typeof min !== "number" || typeof sec !== "number") return null;

  let decimal = deg + min / 60 + sec / 3600;

  // Southern latitudes and Western longitudes are negative
  if (ref === "S" || ref === "W") decimal = -decimal;

  return parseFloat(decimal.toFixed(7));
}

/**
 * Extract GPS coordinates from a parsed EXIF data object.
 *
 * exifr returns GPS values in two possible formats:
 *   1. Already-computed decimals: exifData.latitude / exifData.longitude
 *   2. Raw DMS arrays: exifData.GPSLatitude / exifData.GPSLongitude
 *      with refs:       exifData.GPSLatitudeRef / exifData.GPSLongitudeRef
 *
 * We try format 1 first (simpler), fall back to format 2.
 *
 * @param {Object} exifData  - Parsed EXIF object from exifr
 * @returns {{ lat: number, lon: number } | null}
 */
export function extractGPS(exifData) {
  if (!exifData || typeof exifData !== "object") return null;

  // ── Format 1: exifr already computed decimal coordinates ─────────────────
  if (typeof exifData.latitude === "number" && typeof exifData.longitude === "number") {
    const lat = parseFloat(exifData.latitude.toFixed(7));
    const lon = parseFloat(exifData.longitude.toFixed(7));
    if (isFinite(lat) && isFinite(lon)) return { lat, lon };
  }

  // ── Format 2: raw DMS arrays ──────────────────────────────────────────────
  const latDMS = exifData.GPSLatitude;
  const lonDMS = exifData.GPSLongitude;
  const latRef  = exifData.GPSLatitudeRef  || "N";
  const lonRef  = exifData.GPSLongitudeRef || "E";

  if (!latDMS || !lonDMS) return null;

  const lat = dmsToDecimal(latDMS, latRef);
  const lon = dmsToDecimal(lonDMS, lonRef);

  if (lat === null || lon === null) return null;
  if (!isFinite(lat) || !isFinite(lon)) return null;

  return { lat, lon };
}
