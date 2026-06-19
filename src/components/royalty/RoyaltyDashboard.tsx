import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateUserBalance, getRoyaltyAnalytics, getUserRoyaltyRecords } from '@/lib/royalty';
import RoyaltyChart from './RoyaltyChart';
import WithdrawalButton from './WithdrawalButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle } from 'lucide-react';

const MINIMUM_WITHDRAWAL = 100;

interface RoyaltyDashboardProps {
  userId: string;
}

export default function RoyaltyDashboard({ userId }: RoyaltyDashboardProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [balanceResult, analyticsResult, recordsResult] = await Promise.all([
        calculateUserBalance(userId),
        getRoyaltyAnalytics(userId, 30),
        getUserRoyaltyRecords(userId),
      ]);

      setBalance(balanceResult);
      setAnalytics(analyticsResult);
      setRecords(recordsResult);
      setError(null);
    } catch (err) {
      console.error('Error fetching royalty data:', err);
      setError('Failed to load royalty data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`royalties:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'royalty_records',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const canWithdraw = balance !== null && balance >= MINIMUM_WITHDRAWAL;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-8 text-white">
        <h2 className="text-sm font-semibold opacity-90 mb-2">Total Balance</h2>
        <div className="flex items-baseline justify-between">
          <p className="text-5xl font-bold">${balance?.toFixed(2) || '0.00'}</p>
          <div className="text-right">
            {canWithdraw && <WithdrawalButton userId={userId} balance={balance!} onSuccess={fetchData} />}
          </div>
        </div>
      </div>

      {/* Progress Bar (if balance < $100) */}
      {!canWithdraw && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <p className="mb-3">
              You have earned <strong>${balance?.toFixed(2) || '0.00'}</strong>. Reach{' '}
              <strong>${MINIMUM_WITHDRAWAL}</strong> to enable withdrawals.
            </p>
            <div className="w-full bg-yellow-200 rounded-full h-2 mb-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((balance! / MINIMUM_WITHDRAWAL) * 100, 100)}%`,
                }}
              ></div>
            </div>
            <p className="text-xs">
              ${(MINIMUM_WITHDRAWAL - (balance || 0)).toFixed(2)} more to unlock withdrawals
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Charts (visible only if balance >= $100) */}
      {canWithdraw && analytics.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Earnings Over Time</h3>
          <RoyaltyChart data={analytics} />
        </div>
      )}

      {/* Recent Royalties */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Royalties</h3>
        <RoyaltyRecordsTable records={records} />
      </div>
    </div>
  );
}

function RoyaltyRecordsTable({ records }: { records: any[] }) {
  if (records.length === 0) {
    return <p className="text-gray-500">No royalty records yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">Song</th>
            <th className="text-left px-4 py-2 font-semibold">Amount</th>
            <th className="text-left px-4 py-2 font-semibold">Date</th>
            <th className="text-left px-4 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium">{record.songs?.title || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{record.songs?.isrc || ''}</p>
                </div>
              </td>
              <td className="px-4 py-3 font-semibold">${parseFloat(record.amount.toString()).toFixed(2)}</td>
              <td className="px-4 py-3">{new Date(record.date_earned).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    record.status === 'cleared'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}