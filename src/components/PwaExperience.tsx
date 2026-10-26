import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Globe, Banknote, X } from "lucide-react";

const ONBOARDED_KEY = "zb-onboarded";
const INSTALL_DISMISSED_KEY = "zb-install-dismissed";

export const PwaExperience = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone && !localStorage.getItem(ONBOARDED_KEY)) {
      setShowOnboarding(true);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone && !localStorage.getItem(INSTALL_DISMISSED_KEY)) {
        setShowInstall(true);
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
    } catch {
      // user or browser cancelled the prompt
    }
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setShowInstall(false);
  };

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setShowOnboarding(false);
  };

  return (
    <>
      {showInstall && (
        <div
          data-testid="pwa-install-banner"
          className="fixed bottom-24 right-4 z-50 max-w-xs rounded-xl border border-border bg-card p-4 shadow-glow space-y-3 animate-fade-in"
        >
          <button
            aria-label="Dismiss install prompt"
            data-testid="pwa-install-dismiss"
            onClick={dismissInstall}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZedBute logo" className="h-10 w-10 rounded-lg shrink-0" />
            <p className="text-sm font-medium pr-4">Install ZedBute for one-tap access to your music dashboard.</p>
          </div>
          <Button size="sm" variant="hero" className="w-full" data-testid="pwa-install-button" onClick={install}>
            Install App
          </Button>
        </div>
      )}

      {showOnboarding && (
        <div
          data-testid="pwa-onboarding"
          className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6 text-center animate-fade-in"
        >
          <img src="/logo.png" alt="ZedBute logo" className="h-24 w-24 rounded-3xl shadow-glow mb-6" />
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mb-2">
            Welcome to <span className="text-green-500">zed</span><span className="text-red-500">B</span>ute
          </h1>
          <p className="text-muted-foreground mb-8 max-w-xs">
            Music distribution for independent artists, right from your pocket.
          </p>
          <div className="space-y-4 mb-10 text-left max-w-xs w-full">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Upload className="h-5 w-5 text-primary" /></div>
              <p className="text-sm">Upload your single, EP or album in minutes</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Globe className="h-5 w-5 text-primary" /></div>
              <p className="text-sm">We deliver it to 150+ platforms worldwide</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Banknote className="h-5 w-5 text-primary" /></div>
              <p className="text-sm">You keep 100% of your royalties, always</p>
            </div>
          </div>
          <Button size="lg" variant="hero" data-testid="pwa-onboarding-start" onClick={finishOnboarding}>
            Start Distributing
          </Button>
        </div>
      )}
    </>
  );
};
