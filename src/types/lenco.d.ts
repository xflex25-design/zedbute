interface LencoPayOptions {
  key: string;
  reference: string;
  email: string;
  amount: number;
  currency: string;
  channels: string[];
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  onSuccess: (response: { reference: string }) => void;
  onClose: () => void;
  onConfirmationPending: () => void;
}

interface LencoPayInstance {
  getPaid: (options: LencoPayOptions) => void;
}

declare const LencoPay: LencoPayInstance;
