import { useState, useEffect } from 'react';
import { updateBankDetails, getUserProfile } from '@/lib/royalty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface BankSettingsProps {
  userId: string;
}

export default function BankSettings({ userId }: BankSettingsProps) {
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          setBankName(profile.bank_name || '');
          setBankAccountNumber(profile.bank_account_number || '');
          setBankCode(profile.bank_code || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await updateBankDetails(userId, bankName, bankAccountNumber, bankCode);

      if (!result.success) {
        setError(result.error || 'An error occurred');
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-6">Bank Account Details</h2>

      {error && (
        <Alert className="mb-4 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">Bank details updated successfully!</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="bankName">Bank Name</Label>
          <Input
            id="bankName"
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g., Zanaco Bank"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="bankCode">Bank Code (SWIFT/Sort Code)</Label>
          <Input
            id="bankCode"
            type="text"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            placeholder="e.g., ZABA"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="bankAccountNumber">Account Number</Label>
          <Input
            id="bankAccountNumber"
            type="text"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            placeholder="Your bank account number"
            required
            className="mt-1"
          />
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Security Note:</strong> Your bank details are securely stored and only used for processing withdrawals.
          </AlertDescription>
        </Alert>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Saving...' : 'Save Bank Details'}
        </Button>
      </form>
    </div>
  );
}