import { Navbar } from "@/components/Navbar";
import { Helmet } from "react-helmet-async";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
    <div className="text-sm sm:text-base text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Privacy Policy | ZedBute</title>
      <meta name="description" content="How ZedBute collects, uses and protects your personal data." />
      <link rel="canonical" href="https://www.zedbute.com/privacy" />
    </Helmet>
    <Navbar />
    <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl space-y-8" data-testid="privacy-policy-page">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
      </div>

      <Section title="Who we are">
        <p>ZedBute is a music distribution service for Zambian and independent artists, operated from Zambia. You can reach us at Zedbute@gmail.com or +260 97 411 9780.</p>
      </Section>

      <Section title="What we collect">
        <p>We only collect the data needed to run the service:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account details: your name, email address and password (stored only as a secure hash).</li>
          <li>Release details: track files, cover art, artist name and release metadata you upload for distribution.</li>
          <li>Payment references: mobile money or card transaction references. We never see or store your full card or mobile money PIN.</li>
          <li>Royalty and payout details: bank or mobile money details you provide when requesting a withdrawal.</li>
        </ul>
      </Section>

      <Section title="How we use your data">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and secure your account.</li>
          <li>To deliver your music to streaming platforms and digital stores.</li>
          <li>To process payments and royalty payouts.</li>
          <li>To contact you about your releases, verification status and payouts.</li>
        </ul>
        <p>We do not sell your personal data to anyone.</p>
      </Section>

      <Section title="Third-party services">
        <p>We use a small number of trusted providers to operate ZedBute: Supabase (authentication and database), Vercel (hosting), Pesapal, Lenco and mobile money providers (payments), and Google (optional sign-in). These providers process data only as needed to deliver their service to us.</p>
      </Section>

      <Section title="Cookies" >
        <div id="cookies" className="space-y-2">
          <p>ZedBute uses only essential browser storage:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>An authentication token (kept in your browser's local storage) so you stay signed in.</li>
            <li>A small record of your cookie consent choice.</li>
          </ul>
          <p>We do not use advertising or cross-site tracking cookies. You can clear this storage at any time in your browser settings, which will sign you out.</p>
        </div>
      </Section>

      <Section title="Your rights">
        <p>You may request a copy of your data, ask us to correct it, or ask us to delete your account and associated data by emailing Zedbute@gmail.com. Deleting your account does not recall music already delivered to stores, but we will process takedown requests on your behalf.</p>
      </Section>

      <Section title="Data security">
        <p>Your data is transmitted over HTTPS and stored with access controls. Passwords are never stored in plain text.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>If we change this policy we will update the date above. Continued use of ZedBute after a change means you accept the updated policy.</p>
      </Section>

      <Section title="Contact">
        <p>Privacy questions: Zedbute@gmail.com or +260 97 411 9780 (Zambia).</p>
      </Section>
    </div>
  </div>
);

export default PrivacyPolicy;
