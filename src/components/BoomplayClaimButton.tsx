import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const BOOMPLAY_CLAIM_URL = "https://www.boomplay.com/artists/claim";

export function BoomplayClaimButton() {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-4">
      <Button
        asChild
        className="w-full bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90"
      >
        <a
          href={BOOMPLAY_CLAIM_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Claim Your Artist Profile on Boomplay
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
      <p className="text-sm text-muted-foreground">
        You&apos;ll complete your artist claim directly on Boomplay. We don&apos;t submit this on your behalf.
      </p>
    </div>
  );
}
