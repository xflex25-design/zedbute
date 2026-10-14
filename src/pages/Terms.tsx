import { Navbar } from "@/components/Navbar";
import { Helmet } from "react-helmet-async";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
    <div className="text-sm sm:text-base text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

const Terms = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Terms of Service | ZedBute</title>
      <meta name="description" content="The terms that govern your use of ZedBute music distribution." />
      <link rel="canonical" href="https://www.zedbute.com/terms" />
    </Helmet>
    <Navbar />
    <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl space-y-8" data-testid="terms-page">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
      </div>

      <Section title="1. The service">
        <p>ZedBute distributes your music to streaming platforms and digital stores (including Spotify, Apple Music, Boomplay and others) on your behalf, for a one-time fee per release. ZedBute is operated from Zambia; contact us at Zedbute@gmail.com or +260 97 411 9780.</p>
      </Section>

      <Section title="2. Your account">
        <p>You must provide accurate information when creating an account and keep your sign-in credentials secure. You are responsible for activity on your account.</p>
      </Section>

      <Section title="3. Your music and rights">
        <ul className="list-disc pl-5 space-y-1">
          <li>You keep 100% ownership of your music. By uploading a release you grant ZedBute a non-exclusive licence to deliver it to platforms and stores.</li>
          <li>You confirm you own or control all rights to the recordings, compositions, artwork and metadata you submit, and that they do not infringe anyone else's rights.</li>
          <li>We may reject or remove content that infringes rights, is unlawful, or violates platform rules.</li>
        </ul>
      </Section>

      <Section title="4. Fees and payments">
        <p>Each release type has a one-time distribution fee shown clearly on the Pricing page in Zambian Kwacha (ZMW) and its approximate US Dollar (USD) equivalent. Fees are payable before distribution via mobile money (Airtel Money, MTN MoMo, Zamtel) or card. Artist verification carries a separate one-time processing fee.</p>
      </Section>

      <Section title="5. Royalties">
        <p>You keep 100% of the royalties we receive from platforms for your music. Royalties are credited to your ZedBute balance as platforms report them and can be withdrawn using the payout request feature. Platform reporting schedules and rates are controlled by the platforms, not by ZedBute.</p>
      </Section>

      <Section title="6. Delivery times">
        <p>We aim to deliver releases promptly, but each store reviews content on its own schedule. We recommend submitting at least two weeks before your release date. Delivery timelines are estimates, not guarantees.</p>
      </Section>

      <Section title="7. Acceptable use">
        <p>You may not use ZedBute to distribute content you do not have rights to, to manipulate streams, or for any unlawful purpose. Accounts that abuse the service may be suspended.</p>
      </Section>

      <Section title="8. Liability">
        <p>ZedBute is provided "as is". To the maximum extent permitted by law, ZedBute is not liable for indirect losses, lost earnings, or actions taken by third-party platforms (such as store rejections or takedowns).</p>
      </Section>

      <Section title="9. Changes">
        <p>We may update these terms from time to time; the date above shows the latest version. Continued use of the service means you accept the updated terms.</p>
      </Section>

      <Section title="10. Contact">
        <p>Questions about these terms: Zedbute@gmail.com or +260 97 411 9780 (Zambia).</p>
      </Section>
    </div>
  </div>
);

export default Terms;
