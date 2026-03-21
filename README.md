# ReliefFund — Supabase Setup Guide

Complete replacement of Firebase with Supabase (Auth + PostgreSQL + Storage).

---

## Why Supabase?

| Feature | Firebase | Supabase |
|---|---|---|
| Database | Firestore (NoSQL) | PostgreSQL (SQL) |
| Auth | Firebase Auth | Supabase Auth (GoTrue) |
| Storage | Firebase Storage | Supabase Storage (S3-compatible) |
| Realtime | Yes | Yes |
| Open source | ✗ | ✓ |
| Self-hostable | ✗ | ✓ |
| Free tier | Generous | Generous |
| SQL queries | ✗ | ✓ |

---

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com → **Start your project**
2. Sign in with GitHub
3. Click **New project**
   - Name: `relief-fund`
   - Database password: choose a strong one
   - Region: pick closest to India (e.g. `ap-south-1`)
4. Wait ~2 minutes for provisioning

---

## Step 2 — Get Your API Keys

Go to: **Project Settings → API**

Copy:
- **Project URL** → `https://xxxxxxxxxxxx.supabase.co`
- **anon / public key** → long JWT string

Paste into `supabase-config.js`:

```js
const SUPABASE_URL     = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6...";
```

---

## Step 3 — Create the Database Tables

Go to: **SQL Editor** → **New query** → paste and run:

```sql
-- ── Donations table ──────────────────────────────────────────
CREATE TABLE donations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aadhaar_number text        NOT NULL,
  amount         numeric     NOT NULL CHECK (amount > 0),
  timestamp      text        NOT NULL,
  image_url      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Organisation Payments table ───────────────────────────────
CREATE TABLE org_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        text        NOT NULL,
  org_name      text        NOT NULL,
  product_code  text        NOT NULL,
  mrp           numeric     NOT NULL CHECK (mrp > 0),
  shop_location text        NOT NULL,
  timestamp     text        NOT NULL,
  receipt_url   text,
  gps_lat       double precision,
  gps_lng       double precision,
  gps_accuracy  double precision,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes for faster queries ────────────────────────────────
CREATE INDEX idx_donations_created    ON donations    (created_at DESC);
CREATE INDEX idx_org_payments_org_id  ON org_payments (org_id, created_at DESC);
```

---

## Step 4 — Set Row Level Security (RLS) Policies

Still in the SQL editor, run:

```sql
-- Enable RLS on both tables
ALTER TABLE donations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_payments ENABLE ROW LEVEL SECURITY;

-- Donations: anyone can INSERT (public donation form),
--            only authenticated users can SELECT
CREATE POLICY "Public can donate"
  ON donations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can view donations"
  ON donations FOR SELECT
  TO authenticated
  USING (true);

-- Org payments: only authenticated users can INSERT and SELECT
CREATE POLICY "Authenticated can record payments"
  ON org_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can view own org payments"
  ON org_payments FOR SELECT
  TO authenticated
  USING (true);
```

---

## Step 5 — Create Storage Buckets

Go to: **Storage** → **New bucket**

### Bucket 1: `aadhaar-images`
- Name: `aadhaar-images`
- Public bucket: **✓ Yes** (so image URLs work in the table)
- Click **Create bucket**

### Bucket 2: `receipts`
- Name: `receipts`
- Public bucket: **✓ Yes**
- Click **Create bucket**

Then set storage policies in **SQL Editor**:

```sql
-- Anyone can upload to aadhaar-images (public donation form)
CREATE POLICY "Public aadhaar upload"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'aadhaar-images');

-- Authenticated users can upload receipts
CREATE POLICY "Authenticated receipt upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- Public read for both buckets (so images display)
CREATE POLICY "Public read aadhaar"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'aadhaar-images');

CREATE POLICY "Public read receipts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'receipts');
```

---

## Step 6 — Create Organisation Staff Accounts

Go to: **Authentication → Users → Add user**

| Field | Value |
|---|---|
| Email | `staff@redcross.org` |
| Password | `SecurePassword123` |

Repeat for each organisation staff member.

> **Note:** Unlike Firebase, Supabase does NOT send a confirmation email when you create users manually via the dashboard. They can log in immediately.

To disable email confirmation for new users (optional):
- **Authentication → Settings → Email Auth**
- Turn off **"Enable email confirmations"**

---

## Step 7 — Serve the App

```bash
# Option A — Node serve
npx serve .

# Option B — Python
python3 -m http.server 3000

# Option C — VS Code Live Server
# Right-click index.html → Open with Live Server
```

Open `http://localhost:3000`

---

## Database Schema (Reference)

### `donations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `aadhaar_number` | text | 12-digit number |
| `amount` | numeric | In INR |
| `timestamp` | text | "YYYY-MM-DD HH:MM:SS" |
| `image_url` | text | Supabase Storage URL |
| `created_at` | timestamptz | Auto-generated |

### `org_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `org_id` | text | e.g. "red-cross" |
| `org_name` | text | e.g. "Red Cross Relief" |
| `product_code` | text | e.g. "RICE-001" |
| `mrp` | numeric | In INR |
| `shop_location` | text | Full address |
| `timestamp` | text | "YYYY-MM-DD HH:MM:SS" |
| `receipt_url` | text | Supabase Storage URL |
| `gps_lat` | double precision | Latitude |
| `gps_lng` | double precision | Longitude |
| `gps_accuracy` | double precision | Accuracy in metres |
| `created_at` | timestamptz | Auto-generated |

---

## CSV Export Columns

| Page | Columns |
|---|---|
| Donations | `Aadhar-card number`, `Amount`, `Timestamp` |
| Org Payments | `Product-code`, `MRP`, `Shop-location`, `Timestamp` |

---

## Integration Points

All future plug-in hooks are marked with comments in the code:

```js
// ── OCR INTEGRATION POINT ──  (donate.html + payment.html)
// ── GEOTAGGING INTEGRATION POINT ──  (payment.html)
```

---

## Adding a New Organisation

Edit the `ORGANISATIONS` array in `index.html` and create a Supabase Auth user for their staff. No SQL changes needed.

---

## Useful Supabase SQL Queries

```sql
-- Count all donations
SELECT COUNT(*) FROM donations;

-- Total amount raised
SELECT SUM(amount) FROM donations;

-- All payments for a specific org
SELECT * FROM org_payments WHERE org_id = 'red-cross' ORDER BY created_at DESC;

-- Export donations as CSV (Supabase dashboard)
-- Table Editor → donations → Export CSV
```
