# Royalty Management System - Implementation Guide

## Overview
This is a complete music royalty management platform for Zedbute built with Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Supabase.

## Architecture

### Database Layer (PostgreSQL/Supabase)
- **profiles**: User data including bank account details
- **songs**: Music tracks with ISRC identifiers
- **royalty_records**: Earnings records (pending/cleared)
- **withdrawal_requests**: Payout requests with bank details snapshot

### Security Features
- **Row Level Security (RLS)** on all tables
- Users can only access their own data
- Server-side validation prevents client-side manipulation
- Bank details securely stored and encrypted

### Business Logic

#### The $100 Threshold Rule
1. Balance < $100: Dashboard locked, progress bar shown
2. Balance ≥ $100: Charts unlocked, withdrawal button visible

#### Withdrawal Flow
1. User clicks "Request Withdrawal"
2. Client validates input
3. Server validates: balance ≥ $100
4. Creates withdrawal_requests record with status 'pending'
5. Admin notification sent (via Resend or manual email)
6. Future: Direct Lenco API integration

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create `.env.local` (copy from `.env.example`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
ADMIN_EMAIL=your_admin_email@zedbute.com
```

### 3. Run Supabase Migrations
1. Go to Supabase Dashboard > SQL Editor
2. Create new query
3. Copy contents of `supabase/migrations/001_create_royalty_schema.sql`
4. Run the query

### 4. Testing the $100 Threshold

**Dummy Run Instructions:**
1. Create a test user account in your app
2. Go to Supabase Dashboard > SQL Editor
3. Insert test royalty records:
```sql
-- First, create a test song (replace USER_ID with your test user's ID)
INSERT INTO public.songs (artist_id, title, isrc)
VALUES ('YOUR_TEST_USER_ID', 'Test Song', 'USRC-123-456');

-- Then insert royalty records
INSERT INTO royalty_records (user_id, song_id, amount, date_earned, status)
VALUES (
  'YOUR_TEST_USER_ID',
  (SELECT id FROM songs WHERE isrc = 'USRC-123-456'),
  50.00,
  NOW()::DATE,
  'cleared'
);
```
4. Repeat to reach $100
5. Visit `/royalties` (or wherever you mount the RoyaltyDashboard component)
6. You should see:
   - Balance < $100: Progress bar showing "Reach $100 to enable withdrawals"
   - Balance ≥ $100: Charts and "Request Withdrawal" button appear

## File Structure
```
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── royalty.ts           # Query and action utilities
│   ├── components/royalty/
│   │   ├── RoyaltyDashboard.tsx # Main dashboard component
│   │   ├── RoyaltyChart.tsx     # Recharts visualization
│   │   ├── WithdrawalButton.tsx # Withdrawal modal
│   │   └── BankSettings.tsx     # Bank details form
├── supabase/migrations/
│   └── 001_create_royalty_schema.sql
├── docs/
│   └── ROYALTY_SYSTEM.md        # This file
└── .env.example
```

## Components

### RoyaltyDashboard
Main dashboard component that displays:
- Total balance card
- Progress bar (when balance < $100)
- Charts (when balance ≥ $100)
- Recent royalty records table

**Props:**
```typescript
interface RoyaltyDashboardProps {
  userId: string;  // Current authenticated user ID
}
```

**Usage:**
```tsx
import RoyaltyDashboard from '@/components/royalty/RoyaltyDashboard';

function MyPage() {
  const userId = useAuth().user.id; // Your auth hook
  return <RoyaltyDashboard userId={userId} />;
}
```

### WithdrawalButton
Modal dialog for requesting withdrawals.

**Props:**
```typescript
interface WithdrawalButtonProps {
  userId: string;      // Current authenticated user ID
  balance: number;     // Available balance
  onSuccess?: () => void;  // Callback when withdrawal succeeds
}
```

### BankSettings
Form for saving bank account details.

**Props:**
```typescript
interface BankSettingsProps {
  userId: string;  // Current authenticated user ID
}
```

## API Functions

### calculateUserBalance(userId: string): Promise<number>
Calculates total balance from cleared royalty records.

### getUserRoyaltyRecords(userId: string)
Returns all royalty records for a user with song details.

### getUserWithdrawalRequests(userId: string)
Returns withdrawal request history.

### getRoyaltyAnalytics(userId: string, days?: number)
Returns grouped analytics data for charts.

### requestWithdrawal(userId: string, amount: number)
Server-side withdrawal request with validation.

### updateBankDetails(userId: string, ...details)
Updates user's bank account information.

## Security Checklist

✅ Row Level Security applied to all tables
✅ Server-side balance validation
✅ Bank details encrypted at rest (Supabase)
✅ User can only access own data
✅ Withdrawal amount verified against balance
✅ Admin notifications logged (ready for Resend)

## Future Integrations

### Lenco Payout API
Replace the withdrawal notification in `src/lib/royalty.ts`:
```typescript
// TODO: Replace with Lenco API call
const lenco = new LencoClient(process.env.VITE_LENCO_API_KEY);
await lenco.payouts.create({
  amount: withdrawal.amount,
  bankDetails: {
    accountNumber: withdrawal.bank_account_number,
    code: withdrawal.bank_code,
  },
});
```

### Resend Email Notifications
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.VITE_RESEND_API_KEY);
await resend.emails.send({
  from: 'noreply@zedbute.com',
  to: adminEmail,
  subject: `New Withdrawal Request: $${withdrawal.amount}`,
  html: /* email template */
});
```

## Admin Dashboard

When ready to add admin controls:
1. Create new page: `src/pages/admin/withdrawals.tsx`
2. Add admin RLS policy to `withdrawal_requests` table
3. Display pending withdrawals with status update capability
4. Add export functionality for accounting

## Troubleshooting

### RLS Issues
1. Check Supabase Dashboard > Authentication > Policies
2. Verify user is authenticated before querying
3. Test with `WHERE auth.uid() = id` clause

### Balance Not Updating
1. Check real-time subscription in browser DevTools
2. Verify `royalty_records` has correct `user_id`
3. Ensure record status is 'cleared' for balance calculation

### Withdrawal Modal Not Working
1. Verify bank details are saved before requesting withdrawal
2. Check balance is ≥ $100
3. Review error message in browser console

---

Built with ❤️ for Zedbute Artists