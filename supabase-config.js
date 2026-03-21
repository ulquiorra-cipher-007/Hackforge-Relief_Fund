// ============================================================
//  supabase-config.js — Shared Supabase setup
//  Replace the two constants below with YOUR project values.
//  Find them at: supabase.com → Project → Settings → API
// ============================================================

import { createClient }
  from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── 🔴 REPLACE THESE WITH YOUR SUPABASE PROJECT VALUES ──────────────────────
const SUPABASE_URL    = "https://nxuruwaaqhzfmqivlufx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXJ1d2FhcWh6Zm1xaXZsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTYwMDUsImV4cCI6MjA4OTY5MjAwNX0.c0utRI5Ys6qpsOKnxw2qe2Y8Dx2JRduIeFasw2f0heE";
// ────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Shared Utilities ─────────────────────────────────────────────────────────

/**
 * Generate a formatted local timestamp string.
 * e.g. "2025-06-15 14:32:07"
 */
export function generateTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/**
 * Export an array of objects to a CSV file download.
 * @param {Object[]} rows    - Array of flat objects
 * @param {string[]} columns - Column keys (defines header order)
 * @param {string}   filename
 */
export function exportCSV(rows, columns, filename) {
  const header = columns.join(",");
  const body   = rows.map(row =>
    columns.map(col => {
      const val = row[col] ?? "";
      const str = String(val).replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    }).join(",")
  );
  const csv  = [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Show a toast notification.
 * Requires #toast-container in the page HTML.
 */
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

/**
 * Validate Indian Aadhaar number (12 digits).
 */
export function validateAadhaar(value) {
  return /^\d{12}$/.test(value.replace(/\s/g, ""));
}

/**
 * Upload a file to a Supabase Storage bucket.
 * Returns the public URL, or null on failure.
 *
 * @param {string} bucket  - Supabase storage bucket name
 * @param {string} path    - Path inside the bucket, e.g. "aadhaar/123_card.jpg"
 * @param {File}   file    - The File object to upload
 */
export async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });

  if (error) {
    console.error("Storage upload error:", error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
