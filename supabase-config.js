// ============================================================
//  supabase-config.js — Shared Supabase setup
//  Find your project values at:
//  supabase.com → Project → Settings → API
// ============================================================

import { createClient }
  from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Project credentials ──────────────────────────────────────────────────────
const SUPABASE_URL     = "https://nxuruwaaqhzfmqivlufx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXJ1d2FhcWh6Zm1xaXZsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTYwMDUsImV4cCI6MjA4OTY5MjAwNX0.c0utRI5Ys6qpsOKnxw2qe2Y8Dx2JRduIeFasw2f0heE";
// ────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Shared Utilities ─────────────────────────────────────────────────────────

/**
 * Generate a formatted local timestamp string.
 * Returns a string like "2025-06-15 14:32:07".
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
 *
 * @param {Object[]} rows    - Array of flat objects
 * @param {string[]} columns - Column keys (defines header order)
 * @param {string}   filename - Download filename, e.g. "donations.csv"
 */
export function exportCSV(rows, columns, filename) {
  const escape = (val) => {
    const str = String(val ?? "").replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };

  const header = columns.join(",");
  const body   = rows.map(row =>
    columns.map(col => escape(row[col])).join(",")
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
 * Requires a <div id="toast-container"> in the page HTML.
 *
 * @param {string} message
 * @param {"info"|"success"|"error"} type
 */
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className   = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

/**
 * Validate an Indian Aadhaar number (exactly 12 digits, ignoring spaces).
 *
 * @param {string} value
 * @returns {boolean}
 */
export function validateAadhaar(value) {
  return /^\d{12}$/.test(value.replace(/\s/g, ""));
}

/**
 * Validate a UPI VPA (Virtual Payment Address).
 * Format: localpart@provider   e.g. name@upi, 9876543210@okaxis
 * Returns true for an empty string (field is optional).
 *
 * @param {string} value
 * @returns {boolean}
 */
export function validateUPI(value) {
  if (!value || value.trim() === "") return true;          // optional field
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(value.trim());
}
