export {};

declare global {
  interface LencoPaymentResponse {
    reference?: string;
    data?: {
      reference?: string;
    };
    [key: string]: unknown;
  }

  interface LencoPaymentOptions {
    key: string;
    reference: string;
    email: string;
    amount: number;
    currency: "ZMW";
    channels: Array<"mobile-money" | "card">;
    label?: string;
    customer?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    onSuccess: (response: LencoPaymentResponse) => void | Promise<void>;
    onClose: () => void;
    onConfirmationPending: () => void | Promise<void>;
  }

  interface Window {
    LencoPay?: {
      getPaid: (options: LencoPaymentOptions) => void;
    };
  }
}