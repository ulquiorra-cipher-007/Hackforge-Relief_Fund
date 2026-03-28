/**
 * js/geotag.js
 *
 * Connects the receipt file input in payment.html to EXIF GPS extraction.
 *
 * What this module does:
 *   1. Listens for file selection on #receipt-file (the existing upload input).
 *   2. Enforces JPG/JPEG only — rejects any other format with a clear error.
 *   3. Reads EXIF GPS data using the exifr library (CDN, no install needed).
 *   4. Converts GPS to decimal via exif-reader.js.
 *   5. Updates all existing UI fields: #geo-coords, #sum-gps, verification panel.
 *   6. Stores result in window.geoData for submitPayment() to read.
 *   7. Clears geo state when a non-JPG or GPS-less file is uploaded.
 *
 * window.geoData shape:
 *   { lat: number, lon: number }   — set when GPS is found
 *   null                           — cleared on failure / non-JPG
 */

import { extractGPS } from "./exif-reader.js";

// ── Load exifr from CDN ───────────────────────────────────────────────────────
// exifr is a fast, browser-native EXIF reader. We use the full build which
// includes GPS tag support. It is imported as an ES module.
const exifrUrl = "https://cdn.jsdelivr.net/npm/exifr/dist/full.esm.js";
let exifr = null;

async function loadExifr() {
  if (exifr) return exifr;
  try {
    const mod = await import(exifrUrl);
    exifr = mod;
    return exifr;
  } catch (err) {
    console.error("geotag.js: failed to load exifr from CDN.", err);
    throw new Error("EXIF library could not be loaded. Check your internet connection.");
  }
}

// ── Accepted MIME types ───────────────────────────────────────────────────────
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg"]);

// ── UI helpers ────────────────────────────────────────────────────────────────

function setGeoStatus(type, html) {
  // Reuse the existing map-placeholder area — just update its content
  const hint = document.querySelector(".map-placeholder-hint");
  const coords = document.getElementById("geo-coords");

  if (type === "loading") {
    if (hint) hint.textContent = "⏳ Reading GPS from image…";
    if (coords) { coords.style.display = "none"; coords.textContent = ""; }
  } else if (type === "success") {
    if (hint) hint.textContent = "✅ GPS coordinates extracted from receipt image.";
  } else if (type === "error") {
    if (hint) hint.textContent = html;
    if (coords) { coords.style.display = "none"; coords.textContent = ""; }
  } else if (type === "reset") {
    if (hint) hint.textContent = "GPS coordinates appear here once geotagging is enabled.";
    if (coords) { coords.style.display = "none"; coords.textContent = ""; }
  }
}

function applyGeoToUI(lat, lon) {
  const coordText = `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
  const mapsUrl   = `https://www.google.com/maps?q=${lat},${lon}`;

  // #geo-coords — existing field in the map placeholder
  const coords = document.getElementById("geo-coords");
  if (coords) {
    coords.innerHTML =
      `📍 ${coordText}<br>` +
      `<a href="${mapsUrl}" target="_blank" rel="noopener"
         style="font-size:11px;color:var(--terra);text-decoration:underline;">
         Open in Google Maps ↗
       </a>`;
    coords.style.display = "block";
  }

  // #sum-gps — existing summary panel field
  const sumGps = document.getElementById("sum-gps");
  if (sumGps) sumGps.textContent = coordText;

  // Verification panel — existing elements
  const viGeoIcon   = document.getElementById("vi-geo-icon");
  const viGeoStatus = document.getElementById("vi-geo-status");
  if (viGeoIcon)   viGeoIcon.textContent   = "✅";
  if (viGeoStatus) viGeoStatus.textContent = "Verified";
}

function clearGeoFromUI() {
  const sumGps = document.getElementById("sum-gps");
  if (sumGps) sumGps.textContent = "Not captured";

  const viGeoIcon   = document.getElementById("vi-geo-icon");
  const viGeoStatus = document.getElementById("vi-geo-status");
  if (viGeoIcon)   viGeoIcon.textContent   = "📍";
  if (viGeoStatus) viGeoStatus.textContent = "Pending";

  setGeoStatus("reset");
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function processReceiptFile(file) {
  // Reset geo state before processing
  window.geoData = null;
  clearGeoFromUI();

  // ── Validation: JPG/JPEG only ─────────────────────────────────────────────
  if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
    const msg = "Only geo-tagged JPG images are allowed for receipt upload.";
    alert(msg);
    showToastSafe(msg, "error");

    // Reset the file input so the user can try again
    const input = document.getElementById("receipt-file");
    if (input) input.value = "";

    // Also clear the receipt preview label
    const preview = document.getElementById("receipt-preview");
    if (preview) preview.textContent = "";

    // Reset summary receipt field
    const sumReceipt = document.getElementById("sum-receipt");
    if (sumReceipt) sumReceipt.textContent = "Not uploaded";

    // Reset verification panel receipt status
    const viReceiptStatus = document.getElementById("vi-receipt-status");
    if (viReceiptStatus) viReceiptStatus.textContent = "Pending";

    return;
  }

  // ── Load exifr and parse EXIF ─────────────────────────────────────────────
  setGeoStatus("loading");

  try {
    const lib      = await loadExifr();
    const exifData = await lib.parse(file, {
      // Request only GPS-related tags for speed
      pick: [
        "GPSLatitude", "GPSLatitudeRef",
        "GPSLongitude", "GPSLongitudeRef",
        "latitude", "longitude",
      ],
    });

    // ── Extract decimal GPS ───────────────────────────────────────────────────
    const gps = extractGPS(exifData);

    if (!gps) {
      // File is a valid JPG but has no GPS metadata embedded
      const msg = "This JPG has no GPS metadata. Please use a geo-tagged photo taken on a phone with location enabled.";
      alert(msg);
      showToastSafe(msg, "error");
      setGeoStatus("error", "❌ No GPS metadata found in this image.");
      return;
    }

    // ── GPS found — update state and UI ──────────────────────────────────────
    window.geoData = { lat: gps.lat, lon: gps.lon };
    applyGeoToUI(gps.lat, gps.lon);
    setGeoStatus("success");
    showToastSafe(`✅ GPS extracted: ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`, "success");

  } catch (err) {
    console.error("geotag.js processReceiptFile error:", err);
    setGeoStatus("error", "❌ Could not read GPS from image. " + (err.message || ""));
    showToastSafe("Failed to extract GPS from image.", "error");
  }
}

// ── Safe toast (works even if showToast isn't imported here) ──────────────────
function showToastSafe(message, type) {
  if (typeof window.showToast === "function") {
    window.showToast(message, type);
    return;
  }
  // Fallback: use the toast container directly
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast       = document.createElement("div");
  toast.className   = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// ── Wire up to existing receipt-file input ────────────────────────────────────
// payment.html already has <input id="receipt-file" onchange="handleFileSelect(...)">
// We patch into the change event WITHOUT removing the existing handler.

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("receipt-file");
  if (!input) {
    console.warn("geotag.js: #receipt-file not found. Make sure this script loads after the DOM.");
    return;
  }

  // Restrict the accepted file types at the HTML level too
  input.setAttribute("accept", "image/jpeg,image/jpg");

  // Add our geo handler on top of the existing onchange handler
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) processReceiptFile(file);
  });
});

// ── Expose processReceiptFile globally for drag-drop patching ─────────────────
// payment.html's drag-drop listener sets selectedFile directly.
// We override it so drag-dropped files also go through geo extraction.
window._processReceiptGeo = processReceiptFile;

// ── Initialise geoData ────────────────────────────────────────────────────────
window.geoData = null;
