import { useState } from 'react';
import { requestWithdrawal } from '@/lib/royalty';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface WithdrawalButtonProps {
  userId: string;
  balance: number;
  onSuccess?: () => void;
}

export default function WithdrawalButton({ userId, balance, onSuccess }: WithdrawalButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(balance.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await requestWithdrawal(userId, parseFloat(amount));

      if (!result.success) {
        setError(result.error || 'An error occurred');
      } else {
        setSuccess(true);
        setIsOpen(false);
        onSuccess?.();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="bg-white text-blue-600 hover:bg-blue-50">
        Request Withdrawal
      </Button>

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Withdrawal request submitted successfully!
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="flex gap-2 mt-1">
                <span className="text-gray-500 self-center">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={balance}
                  className="flex-1"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Available: ${balance.toFixed(2)}</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Processing...' : 'Request Withdrawal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}