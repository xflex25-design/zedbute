import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { onceApi } from "@/services/onceApi";
import type { DistributionStore } from "../../../server/once/types";
import { Music, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

interface StoreSelectorProps {
  selectedStoreIds: number[] | null;
  onChange: (storeIds: number[]) => void;
  languageCode?: string;
}

// Accurate fallback synced with live GET https://once.app/v1/distribution-stores
const FALLBACK_STORES: DistributionStore[] = [
  { storeId: 1, name: "Apple Music", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["itunes"] },
  { storeId: 9, name: "Spotify", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["spotify"] },
  { storeId: 13, name: "YouTube Music", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["yt"] },
  { storeId: 319, name: "TikTok", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["tt"] },
  { storeId: 321, name: "Boomplay", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["boomplay"] },
  { storeId: 334, name: "Audiomack", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["audiomack"] },
  { storeId: 17, name: "Amazon", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["amazon"] },
  { storeId: 14, name: "Tidal", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["tidal"] },
  { storeId: 68, name: "SoundCloud", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["soundcloud"] },
  { storeId: 41, name: "Pandora", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["pandora"] },
  { storeId: 85, name: "iHeartRadio", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["iheart"] },
  { storeId: 91, name: "Anghami", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["anghami"] },
  { storeId: 110, name: "Jiosaavn", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["jiosaavn"] },
  { storeId: 323, name: "Snap", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["snapchat"] },
  { storeId: 309, name: "Facebook Audio Library", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["meta"] },
  { storeId: 315, name: "Mixcloud", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["mixcloud"] },
  { storeId: 371, name: "JOOX", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["joox"] },
  { storeId: 45, name: "KKBOX", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["kkbox"] },
  { storeId: 307, name: "YouTube Content ID", featured: false, enabledByDefault: false, partnerOnly: true, aliases: ["cid"] },
  { storeId: 310, name: "Facebook Rights Manager", featured: false, enabledByDefault: false, partnerOnly: true, aliases: ["meta rights"] },
];

const UGC_RESTRICTED_LANGS = new Set(["hi", "ur", "id", "vi", "pt", "pt-br", "tr"]);
const UGC_IDS = new Set([307, 310]);

export function StoreSelector({ selectedStoreIds, onChange, languageCode }: StoreSelectorProps) {
  const [stores, setStores] = useState<DistributionStore[]>(FALLBACK_STORES);
  const [defaultIds, setDefaultIds] = useState<number[]>(
    FALLBACK_STORES.filter((s) => s.enabledByDefault).map((s) => s.storeId)
  );
  const [loading, setLoading] = useState(true);

  const activeIds = Array.isArray(selectedStoreIds) ? selectedStoreIds : defaultIds;
  const ugcBlockedByLanguage = Boolean(languageCode && UGC_RESTRICTED_LANGS.has(languageCode.toLowerCase()));

  useEffect(() => {
    let mounted = true;
    onceApi
      .getDistributionStores()
      .then((data) => {
        if (!mounted) return;
        if (data?.stores && data.stores.length > 0) {
          setStores(data.stores);
          if (data.defaultStoreIds && data.defaultStoreIds.length > 0) {
            setDefaultIds(data.defaultStoreIds);
            if (!selectedStoreIds || selectedStoreIds.length === 0) {
              onChange(data.defaultStoreIds);
            }
          }
        }
      })
      .catch((err) => {
        console.warn("[StoreSelector] Using fallback store list:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleStore = (storeId: number) => {
    if (ugcBlockedByLanguage && UGC_IDS.has(storeId)) {
      return;
    }
    if (activeIds.includes(storeId)) {
      onChange(activeIds.filter((id) => id !== storeId));
    } else {
      onChange([...activeIds, storeId]);
    }
  };

  const selectDefaults = () => {
    onChange(
      defaultIds.filter((id) => !(ugcBlockedByLanguage && UGC_IDS.has(id)))
    );
  };

  const selectAllAvailable = () => {
    onChange(
      stores
        .filter((s) => !s.partnerOnly && !(ugcBlockedByLanguage && UGC_IDS.has(s.storeId)))
        .map((s) => s.storeId)
    );
  };

  const selectPopular = () => {
    const popular = [1, 9, 13, 319, 321, 334, 17, 14];
    onChange(popular.filter((id) => stores.some((s) => s.storeId === id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Streaming Stores & Platforms</Label>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="secondary" className="text-xs">
              {activeIds.length} / {stores.length} selected
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectDefaults}>
            ONCE Recommended
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAllAvailable}>
            All Standard Stores
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectPopular}>
            Popular Only
          </Button>
        </div>
      </div>

      {ugcBlockedByLanguage && (
        <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            YouTube Content ID and Facebook Rights Manager are unavailable for releases in this language/region per ONCE distribution policy. Standard streaming stores (including YouTube Music) remain active.
          </span>
        </div>
      )}

      {activeIds.length === 0 && (
        <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive">
          Select at least one streaming store before submitting.
        </div>
      )}

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-3 rounded-lg border border-border/70 bg-card/40">
        {stores.map((store) => {
          const isSelected = activeIds.includes(store.storeId);
          const isUgcBlocked = ugcBlockedByLanguage && UGC_IDS.has(store.storeId);
          const checkboxId = `once-store-${store.storeId}`;
          return (
            <label
              key={store.storeId}
              htmlFor={checkboxId}
              className={`flex items-center space-x-2 p-2.5 rounded-md border text-xs text-left transition-colors select-none ${
                isUgcBlocked
                  ? "opacity-45 cursor-not-allowed bg-muted/20 border-border/30 text-muted-foreground"
                  : isSelected
                    ? "cursor-pointer bg-primary/10 border-primary/40 text-foreground"
                    : "cursor-pointer bg-background/40 border-border/50 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Checkbox
                id={checkboxId}
                checked={isSelected}
                disabled={isUgcBlocked}
                onCheckedChange={() => toggleStore(store.storeId)}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className="truncate font-medium flex-1">{store.name}</span>
              {store.featured && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              {store.partnerOnly && !store.featured && (
                <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  Partner
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
