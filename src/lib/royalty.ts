import { supabase } from './supabase';

/**
 * Calculate total balance for a user
 * Returns the sum of all cleared royalty records
 */
export async function calculateUserBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('royalty_records')
    .select('amount')
    .eq('user_id', userId)
    .eq('status', 'cleared');

  if (error) {
    console.error('Error calculating balance:', error);
    throw new Error('Failed to calculate balance');
  }

  const total = data?.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0) || 0;
  return total;
}

/**
 * Get user profile with bank details
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching profile:', error);
    throw new Error('Failed to fetch profile');
  }

  return data || null;
}

/**
 * Get all royalty records for a user
 */
export async function getUserRoyaltyRecords(userId: string) {
  const { data, error } = await supabase
    .from('royalty_records')
    .select('*, songs(title, isrc)')
    .eq('user_id', userId)
    .order('date_earned', { ascending: false });

  if (error) {
    console.error('Error fetching royalty records:', error);
    throw new Error('Failed to fetch royalty records');
  }

  return data || [];
}

/**
 * Get withdrawal requests for a user
 */
export async function getUserWithdrawalRequests(userId: string) {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching withdrawal requests:', error);
    throw new Error('Failed to fetch withdrawal requests');
  }

  return data || [];
}

/**
 * Get royalty analytics for charts
 */
export async function getRoyaltyAnalytics(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('royalty_records')
    .select('date_earned, amount, status')
    .eq('user_id', userId)
    .gte('date_earned', startDate.toISOString().split('T')[0])
    .order('date_earned', { ascending: true });

  if (error) {
    console.error('Error fetching analytics:', error);
    throw new Error('Failed to fetch analytics');
  }

  // Group by date
  const grouped = (data || []).reduce(
    (acc: Record<string, { total: number; pending: number; cleared: number }>, record: any) => {
      const date = record.date_earned;
      if (!acc[date]) {
        acc[date] = { total: 0, pending: 0, cleared: 0 };
      }
      const amount = parseFloat(record.amount.toString());
      acc[date].total += amount;
      if (record.status === 'cleared') {
        acc[date].cleared += amount;
      } else {
        acc[date].pending += amount;
      }
      return acc;
    },
    {}
  );

  return Object.entries(grouped).map(([date, values]) => ({
    date,
    ...values,
  }));
}

/**
 * Request a withdrawal with server-side validation
 */
export async function requestWithdrawal(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string; withdrawal?: any }> {
  try {
    const MINIMUM_WITHDRAWAL = 100;

    if (!userId || isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Invalid input' };
    }

    // Step 1: Calculate current balance
    const { data: royalties, error: royaltyError } = await supabase
      .from('royalty_records')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'cleared');

    if (royaltyError) {
      console.error('Error fetching royalties:', royaltyError);
      return { success: false, error: 'Failed to process withdrawal' };
    }

    const totalBalance = royalties?.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0) || 0;

    // Step 2: Validate $100 threshold
    if (totalBalance < MINIMUM_WITHDRAWAL) {
      return {
        success: false,
        error: `Insufficient balance. Minimum required: $${MINIMUM_WITHDRAWAL}. Current balance: $${totalBalance.toFixed(2)}`,
      };
    }

    // Step 3: Validate withdrawal amount doesn't exceed balance
    if (amount > totalBalance) {
      return {
        success: false,
        error: `Withdrawal amount exceeds available balance of $${totalBalance.toFixed(2)}`,
      };
    }

    // Step 4: Get user's bank details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bank_name, bank_account_number, bank_code')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Bank details not found. Please update your profile.' };
    }

    // Step 5: Create withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: userId,
        amount,
        bank_name: profile.bank_name,
        bank_account_number: profile.bank_account_number,
        bank_code: profile.bank_code,
        status: 'pending',
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error('Error creating withdrawal request:', withdrawalError);
      return { success: false, error: 'Failed to create withdrawal request' };
    }

    // TODO: Send admin notification via Resend or other service
    console.log('Withdrawal request created:', withdrawal);

    return { success: true, withdrawal };
  } catch (error) {
    console.error('Withdrawal request error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update user bank details
 */
export async function updateBankDetails(
  userId: string,
  bankName: string,
  bankAccountNumber: string,
  bankCode: string
): Promise<{ success: boolean; error?: string; profile?: any }> {
  try {
    if (!userId || !bankName || !bankAccountNumber || !bankCode) {
      return { success: false, error: 'All fields are required' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          bank_name: bankName,
          bank_account_number: bankAccountNumber,
          bank_code: bankCode,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating bank details:', error);
      return { success: false, error: 'Failed to update bank details' };
    }

    return { success: true, profile: data };
  } catch (error) {
    console.error('Bank details update error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}