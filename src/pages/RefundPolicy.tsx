import { Navbar } from "@/components/Navbar";
import { Helmet } from "react-helmet-async";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
    <div className="text-sm sm:text-base text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

const RefundPolicy = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Refund Policy | ZedBute</title>
      <meta name="description" content="When ZedBute payments are refundable and how to request a refund." />
      <link rel="canonical" href="https://www.zedbute.com/refund-policy" />
    </Helmet>
    <Navbar />
    <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl space-y-8" data-testid="refund-policy-page">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Refund Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
      </div>

      <Section title="Before distribution starts">
        <p>If you have paid for a release but it has not yet been submitted to platforms, you can request a full refund. Contact us with your payment reference and we will reverse the payment to the same mobile money or card account.</p>
      </Section>

      <Section title="After distribution starts">
        <p>Once a release has been delivered to platforms, the distribution fee has been earned and is non-refundable. If a store rejects your release, we will tell you why and help you fix and resubmit it at no extra charge.</p>
      </Section>

      <Section title="Duplicate or failed payments">
        <p>If you were charged twice for the same release, or money left your account but the payment shows as failed on ZedBute, contact us with the transaction reference. Verified duplicate or failed charges are refunded in full.</p>
      </Section>

      <Section title="Verification fees">
        <p>Artist verification processing fees are refundable only if the verification request has not yet been submitted to the platform.</p>
      </Section>

      <Section title="How to request a refund">
        <p>Email Zedbute@gmail.com or WhatsApp +260 97 411 9780 with your account email, the release title and your payment reference. We review refund requests within 7 business days and process approved refunds to the original payment method.</p>
      </Section>
    </div>
  </div>
);

export default RefundPolicy;
