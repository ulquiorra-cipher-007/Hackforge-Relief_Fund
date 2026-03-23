// ============================================================
//  supabase-config.js — Shared Supabase setup
//  All pages import from this single file.
//
//  Find your project values at:
//  supabase.com → Project → Settings → API
// ============================================================

import { createClient }
  from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Project credentials ──────────────────────────────────────────────────────
const SUPABASE_URL      = "https://nxuruwaaqhzfmqivlufx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dXJ1d2FhcWh6Zm1xaXZsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTYwMDUsImV4cCI6MjA4OTY5MjAwNX0.c0utRI5Ys6qpsOKnxw2qe2Y8Dx2JRduIeFasw2f0heE";
// ────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  Auth helpers
// ============================================================

/**
 * Sign in with email + password.
 * Returns { user, session, error }.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, session: data?.session ?? null, error };
}

/**
 * Sign the current user out.
 */
export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Return the current active session (or null).
 * Use this to guard protected pages.
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

/**
 * Fetch the organisation record linked to the currently logged-in user.
 *
 * Flow:
 *   supabase.auth.users  (managed by Supabase — never touched directly)
 *         └─ organisations.auth_user_id  (foreign key → auth.users.id)
 *
 * Returns the full organisation row, or null if not found / not logged in.
 */
export async function getMyOrganisation() {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("organisations")
    .select("*")
    .eq("auth_user_id", session.user.id)
    .single();

  if (error) {
    console.error("getMyOrganisation:", error.message);
    return null;
  }
  return data;
}

// ============================================================
//  Shared UI utilities
// ============================================================

/** Generate a formatted local timestamp: "2025-06-15 14:32:07" */
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
 * @param {Object[]} rows
 * @param {string[]} columns
 * @param {string}   filename
 */
export function exportCSV(rows, columns, filename) {
  const escape = (val) => {
    const str = String(val ?? "").replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const header = columns.join(",");
  const body   = rows.map(row => columns.map(col => escape(row[col])).join(","));
  const csv    = [header, ...body].join("\n");
  const blob   = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Show a toast notification.
 * Requires <div id="toast-container"> in the page.
 */
export function showToast(message, type = "info") {
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
  }, 4000);
}

/** Validate a 12-digit Indian Aadhaar number (spaces ignored). */
export function validateAadhaar(value) {
  return /^\d{12}$/.test(value.replace(/\s/g, ""));
}

/** Validate a UPI VPA. Returns true for empty (optional field). */
export function validateUPI(value) {
  if (!value || value.trim() === "") return true;
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(value.trim());
}
