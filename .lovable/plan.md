# Plan

Apply the previously-approved changes now that the DB migration has run.

## 1. `src/pages/UploadRelease.tsx`
- Add an **Artist Name** text input (required) above the Title field.
- Persist `artistName` in `sessionStorage` alongside other fields.
- Validate non-empty before submit; pass `artist_name` when inserting into `music_releases`.

## 2. `src/pages/Pricing.tsx`
- Remove all existing tier cards.
- Replace with one centered card: "Upload your release for just **K50**" — one-time per release, paid via Mobile Money or Card (Lenco). CTA → `/upload-release` (or `/auth` if signed out).

## 3. `src/pages/Verify.tsx`
- Rewrite as a shadcn `Tabs` UI with three tabs sharing the same Lenco flow as `Payment.tsx`:
  - **Spotify (K50)** — green theme. Fields: Spotify email → `platform_email`, artist name → `artist_name`, Spotify URI → `spotify_url`, social → `instagram_url`.
  - **Boomplay (K50)** — orange theme. Fields: Boomplay email → `platform_email`, artist name → `artist_name`, Boom ID → `platform_user_id`, social → `instagram_url`.
  - **YouTube OAC (K260)** — red theme. Fields: channel name → `artist_name`, channel URL → `youtube_url`, topic channel URL → `topic_channel_url`, distributor (DistroKid/TuneCore/CD Baby/ONErpm/Other) → `distributor_name`.
- Each submit: show loading spinner, call `LencoPay.getPaid` with `ZMW` and reference `verification-{platform}-{userId}-{ts}`. On Lenco success/confirmation-pending only, insert into `artist_verifications` with `platform`, `payment_status: 'paid'`, `status: 'pending'`, `deposit_amount`, `payment_transaction_id`. Toast: "Payment Confirmed via Lenco! Your request is being processed. 🚀".

## Files
- `src/pages/UploadRelease.tsx`
- `src/pages/Pricing.tsx`
- `src/pages/Verify.tsx`

No further DB changes — migration already applied.