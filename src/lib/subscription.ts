export const SUBSCRIPTION_PLANS = {
  monthly: { amount: 200, durationDays: 30, label: "Monthly Plan" },
  annual: { amount: 500, durationDays: 365, label: "Annual Plan" },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;
export type SubscriptionStatus = "none" | "pending" | "active" | "expired" | "cancelled";

export function getPlan(plan: string): (typeof SUBSCRIPTION_PLANS)[SubscriptionPlan] | null {
  return plan in SUBSCRIPTION_PLANS ? SUBSCRIPTION_PLANS[plan as SubscriptionPlan] : null;
}

export function calculateRenewalExpiry(now: Date, currentExpiry: Date | null, plan: SubscriptionPlan): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const expiry = new Date(base);
  expiry.setUTCDate(expiry.getUTCDate() + SUBSCRIPTION_PLANS[plan].durationDays);
  return expiry;
}

export function daysRemaining(now: Date, expiry: Date | null): number {
  if (!expiry) return 0;
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000));
}

export function isExpiringSoon(now: Date, expiry: Date | null): boolean {
  const days = daysRemaining(now, expiry);
  return days > 0 && days <= 7;
}

export function isSuccessfulPayment(status: string, amount: number, expectedAmount: number, currency: string): boolean {
  return status.toLowerCase() === "successful" && amount === expectedAmount && currency.toUpperCase() === "ZMW";
}

export const DISTRIBUTOR_URL = "https://music.zedbute.com/login";

export const DistributorAccessService = {
  async activateUser(_userId: string) {
    return { handled: false, reason: "WhitelabelDASH activation API is not configured." } as const;
  },
  async suspendUser(_userId: string) {
    return { handled: false, reason: "WhitelabelDASH suspension API is not configured." } as const;
  },
  async getUserStatus(_userId: string) {
    return { status: "manual", reason: "WhitelabelDASH status API is not configured." } as const;
  },
};
