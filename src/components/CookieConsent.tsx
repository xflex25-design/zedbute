import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "zedbute-cookie-consent";

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  const choose = (value: string) => {
    localStorage.setItem(KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 inset-x-0 z-50 p-4 bg-card/95 backdrop-blur border-t border-border shadow-lg"
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-6 max-w-4xl">
        <p className="text-sm text-muted-foreground flex-1 text-center sm:text-left">
          ZedBute uses only essential browser storage to keep you signed in — no advertising or tracking cookies.
          See our <a href="/privacy" className="text-primary hover:underline">Privacy &amp; Cookie Policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" data-testid="cookie-decline-btn" onClick={() => choose("essential")}>
            Essential only
          </Button>
          <Button size="sm" variant="hero" data-testid="cookie-accept-btn" onClick={() => choose("accepted")}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};
