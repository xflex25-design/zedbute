
## 1. New Artist Analytics Dashboard (replaces `/dashboard`)

Rebuild `src/pages/Dashboard.tsx` with the new layout. Keep existing `Navbar` (already has Dashboard link), footer, auth gate, and color scheme. Use semantic Tailwind tokens (`bg-card`, `text-foreground`, `bg-gradient-primary`, `shadow-card`) — no raw hex.

**Sections:**

1. **Hero CTA button** — full-width `bg-gradient-primary` button "+ Create Artist" → routes to `/verify-claim`. Rounded-xl, bold white text.
2. **Stat cards** — 4 cards. Mobile: horizontal scroll (`overflow-x-auto flex gap-4 snap-x`). Desktop: `grid-cols-2 lg:grid-cols-4`. Each card:
   - Top 2px accent bar (alternating primary/secondary tokens)
   - Rounded-lg icon tile (left) with `bg-primary/10` or `bg-secondary/10`
   - Big number, green ↑ 0% chip, "vs previous period" muted subtitle
   - Cards: Monthly Streams (Headphones), Monthly Listeners (Users), Estimated Royalties ZMW (Wallet), Total Releases (Disc) — all hardcoded mock numbers
3. **Streams chart** — Recharts `AreaChart` with smooth `monotone` line + gradient fill (linearGradient stops using `hsl(var(--primary))` → `hsl(var(--secondary))`, fill fades to transparent). 12 months of mock data. Time filter tab group above: "7 Days | 30 Days | 12 Months", active tab `bg-primary text-primary-foreground`. Swap mock dataset per tab. Wrapped in `ResponsiveContainer`.
4. **Releases table** — Section header "Your Releases" + "+ New Release" button (→ `/upload-release`). Desktop: shadcn `Table` with columns Cover | Title | Type | Release Date | Platforms | Streams (right-aligned) | Status. Mobile (`md:hidden`): same data as stacked cards. 5 mock rows with Zambian names (e.g. "Yo Maps – Location", "Chef 187 – Bon Appétit", "Slapdee – King Cobra", "Macky 2 – Money Maker", "Tay Grin – Mr. Tay"). Type and Status rendered as shadcn `Badge` (green=Live, yellow=Processing, grey=Pending).

Install `recharts` if missing (`bun add recharts`). No backend/data-fetch changes — all stats and rows are hardcoded mock. Verification banner from current dashboard is removed (the new "+ Create Artist" button covers that entry point).

## 2. Upload Release form — bug fixes

End-to-end pass on `src/pages/UploadRelease.tsx`. Confirmed bugs:

- **Files lost across payment redirect.** When the user submits without payment, only text fields are stashed in `sessionStorage`; `coverArt` and `audioFile` (File objects) can't be JSON-serialized, so after returning from `/payment` the user must re-pick both files with no warning. Fix: after returning with `pendingReleasePayment=completed`, detect missing files and show a clear toast + scroll to the upload section telling the user to re-attach cover art and audio. Also persist file *names* so the UI can prompt "Re-attach cover.jpg".
- **Strict 3000×3000 validator with no helper UI.** Keep the rule (per memory) but: show the required dimensions inline next to the upload field, and on rejection keep the previous valid file instead of leaving the field empty.
- **Audio progress simulator can leak.** `progressInterval` is cleared on success/failure paths inside `try`, but if `setIsUploadingAudio` is unmounted the interval keeps running. Wrap in a ref and clear in a `finally` + on unmount.
- **`hasValidPayment` initial state.** It starts `null` and is only set to `true` when sessionStorage flag is present — otherwise it stays `null` and the loading spinner shows forever. Fix: default to `false` after `checkUser` completes if no pending flag.
- **`releaseDate` optional but `FormProgress` marks it required.** Either make it actually required (preferred — matches the progress UI) by adding a validation check in `handleSubmit`, or remove from the progress steps. Plan: require it.
- **Submit button has no inline disabled state when uploading.** Confirm `disabled={loading}` is set; if missing, add it. Also disable during file validation.

After fixes, manually walk through: no payment → fill form → submit → redirected to payment → return → re-attach files → submit → row appears in dashboard releases (mock dashboard ignores this, but DB insert must still succeed).

## Technical notes

- File: `src/pages/Dashboard.tsx` — full rewrite.
- File: `src/pages/UploadRelease.tsx` — targeted edits in `checkUser`, `handleSubmit`, image/audio handlers; small JSX additions for the re-attach hint.
- New dep: `recharts` (only if not already present).
- No DB migrations. No new routes. Navbar untouched.
- Mock data lives inline in `Dashboard.tsx` as typed constants.
