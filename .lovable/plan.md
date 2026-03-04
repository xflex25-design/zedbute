

## Fix Pricing Inconsistencies

Two changes needed to make pricing consistent across the app:

### 1. Fix Starter plan price on Pricing page
- **File:** `src/pages/Pricing.tsx` (line 22)
- Change `"K399"` to `"K339"`

### 2. Fix release upload price in UploadRelease page
- **File:** `src/pages/UploadRelease.tsx` (line 392)
- Change `"Payment required (K399)"` to `"Payment required (K50)"`

### Summary of prices after fix
| Item | Price |
|------|-------|
| Starter plan | K339/year |
| Pro plan | K799/year |
| Label plan | K1999/year |
| Release upload fee | K50 |
| Verification fee | K30 |

The Payment page (`Payment.tsx`) already correctly shows K50 for releases and K30 for verification -- no changes needed there.

