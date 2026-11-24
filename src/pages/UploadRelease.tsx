import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { onceApi } from "@/services/onceApi";
import { StoreSelector } from "@/components/once/StoreSelector";
import { MetadataValidationBanner } from "@/components/once/MetadataValidationBanner";
import {
  UPLOAD_WIZARD_STEPS,
  UploadWizardStepper,
} from "@/components/upload/UploadWizardStepper";
import { FieldValidationMessage } from "@/components/upload/FieldValidationMessage";
import { getVisibleFieldIssue, validateWizardFields } from "@/lib/onceFieldValidation";
import {
  CLIENT_AUDIO_SPECS,
  CLIENT_COVER_SPECS,
  ONCE_GENRE_OPTIONS,
  ONCE_LANGUAGE_OPTIONS,
  ONCE_SUBGENRE_OPTIONS,
} from "@/lib/onceCatalog";
import {
  formatDurationMmSs,
  inspectAndValidateAudioFile,
  inspectAndValidateCoverArt,
} from "@/lib/mediaInspection";
import type {
  AudioFileInspection,
  CoverArtInspection,
  OnceDistributionReleaseRecord,
  OnceReleaseInput,
  OnceTrackInput,
  ReleaseQuoteResponse,
  ReleaseStatusResponse,
  ValidationReport,
} from "../../server/once/types";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

interface WizardTrackState {
  id: string;
  title: string;
  titleVersion: string;
  trackType: "original" | "cover" | "public_domain";
  explicitFlag: boolean;
  songwriterName: string;
  extraWritersText: string;
  isrc: string;
  lyrics: string;
  previewStartSeconds: number;
  audioFileUrl: string;
  audioFileName: string;
  audioMetadata?: AudioFileInspection;
  uploadTarget?: "once" | "zedbute_storage";
  uploadProgress: number;
  uploading: boolean;
  uploadError?: string;
}

interface WizardFormState {
  // Step 1: Artist & Credits
  primaryArtistName: string;
  featuredArtistsText: string;
  spotifyArtistUrl: string;
  appleMusicArtistUrl: string;
  composerName: string;
  defaultSongwriterName: string;
  producerName: string;
  labelName: string;

  // Step 2: Release Information & Copyright
  title: string;
  titleVersion: string;
  releaseType: "single" | "ep" | "album";
  genre: string;
  subGenre: string;
  languageCode: string;
  description: string;
  releaseDate: string;
  hasOriginalReleaseDate: boolean;
  originalReleaseDate: string;
  clineOwner: string;
  clineYear: string;
  plineOwner: string;
  plineYear: string;

  // Step 3: Media
  coverArtFileUrl: string;
  coverArtFileName: string;
  coverArtMetadata?: CoverArtInspection;
  coverUploadTarget?: "once" | "zedbute_storage";

  // Step 4: Distribution
  distributionStoreIds: number[];
  distributionMode: "once_api" | "manual_k70";

  // Step 5: Confirmation
  rightsConfirmed: boolean;
  submissionConfirmed: boolean;
}

const LOCAL_DRAFT_STORAGE_KEY = "zedbute_upload_wizard_draft_v2";

function defaultTargetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function createEmptyTrack(index: number): WizardTrackState {
  return {
    id: `track_${index}_${Date.now()}`,
    title: "",
    titleVersion: "",
    trackType: "original",
    explicitFlag: false,
    songwriterName: "",
    extraWritersText: "",
    isrc: "",
    lyrics: "",
    previewStartSeconds: 15,
    audioFileUrl: "",
    audioFileName: "",
    uploadProgress: 0,
    uploading: false,
  };
}

function createInitialFormState(): WizardFormState {
  const year = String(new Date().getFullYear());
  return {
    primaryArtistName: "",
    featuredArtistsText: "",
    spotifyArtistUrl: "",
    appleMusicArtistUrl: "",
    composerName: "",
    defaultSongwriterName: "",
    producerName: "",
    labelName: "",
    title: "",
    titleVersion: "",
    releaseType: "single",
    genre: "Afrobeats",
    subGenre: "",
    languageCode: "en",
    description: "",
    releaseDate: defaultTargetDate(),
    hasOriginalReleaseDate: false,
    originalReleaseDate: "",
    clineOwner: "",
    clineYear: year,
    plineOwner: "",
    plineYear: year,
    coverArtFileUrl: "",
    coverArtFileName: "",
    distributionStoreIds: [1, 9, 13, 319, 321, 334, 17, 14],
    distributionMode: "once_api",
    rightsConfirmed: false,
    submissionConfirmed: false,
  };
}

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  english: "en",
  bemba: "bem",
  nyanja: "ny",
  tonga: "toi",
  lozi: "loz",
  lunda: "lun",
  kaonde: "kqn",
  luvale: "lue",
};

const CODE_TO_ZEDBUTE_LANGUAGE: Record<string, string> = {
  en: "English",
  bem: "Bemba",
  ny: "Nyanja",
  toi: "Tonga",
  loz: "Lozi",
  lun: "Lunda",
  kqn: "Kaonde",
  lue: "Luvale",
};

function fieldToStep(field: string): number {
  if (
    field.includes("primary_artist") ||
    field.includes("contributors") ||
    field.includes("writers") ||
    field.includes("label")
  ) {
    return 1;
  }
  if (
    field.includes("cover_art") ||
    field.includes("audio_file_url")
  ) {
    return 3;
  }
  if (field.includes("distribution_store_ids")) {
    return 4;
  }
  return 2;
}

export default function UploadRelease() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Edit mode (existing music_releases record via ?id=...)
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [existingRelease, setExistingRelease] = useState<any>(null);
  const [isLoadingRelease, setIsLoadingRelease] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(createInitialFormState);
  const [tracks, setTracks] = useState<WizardTrackState[]>([createEmptyTrack(1)]);
  const [localDraftId, setLocalDraftId] = useState<string | undefined>(undefined);
  const [onceDraftId, setOnceDraftId] = useState<string | undefined>(undefined);
  const [unfinishedDrafts, setUnfinishedDrafts] = useState<OnceDistributionReleaseRecord[]>([]);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = useRef<number | null>(null);
  const hasHydratedRef = useRef(false);

  // Cover upload state
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverValidating, setCoverValidating] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Validation, Quote, Submission & Status tracking
  const [manualPriceZmw, setManualPriceZmw] = useState(70);
  const [metadataRules, setMetadataRules] = useState<{
    markdown: string;
    source?: "live" | "cached_spec";
  } | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [stepAttempted, setStepAttempted] = useState<Record<number, boolean>>({});
  const [validatingReport, setValidatingReport] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<(ReleaseQuoteResponse & { accountCredits?: number | null }) | null>(null);
  const [quoteNotice, setQuoteNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    onceReleaseId?: string;
    zedbuteRecordId?: string;
    status: string;
    upc?: string;
    liveStatus?: ReleaseStatusResponse | null;
  } | null>(null);
  const [syncingStatus, setSyncingStatus] = useState(false);

  const markTouched = useCallback((fieldKey: string) => {
    setTouchedFields((prev) => (prev[fieldKey] ? prev : { ...prev, [fieldKey]: true }));
  }, []);

  const fieldValidation = useMemo(
    () =>
      validateWizardFields(form, tracks, {
        rulesMarkdown: metadataRules?.markdown,
        isEditMode,
      }),
    [form, tracks, metadataRules?.markdown, isEditMode]
  );

  const getFieldIssue = useCallback(
    (fieldKey: string, stepNumber: number) =>
      getVisibleFieldIssue(fieldValidation, fieldKey, touchedFields, stepAttempted, stepNumber),
    [fieldValidation, touchedFields, stepAttempted]
  );

  const fieldInputClass = useCallback(
    (fieldKey: string, stepNumber: number, baseClass = "") => {
      const issue = getFieldIssue(fieldKey, stepNumber);
      if (issue?.severity === "error") {
        return `${baseClass} border-destructive focus-visible:ring-destructive`.trim();
      }
      if (issue?.severity === "warning") {
        return `${baseClass} border-foreground/50 focus-visible:ring-foreground`.trim();
      }
      return baseClass;
    },
    [getFieldIssue]
  );

  // -------------------------------------------------------------
  // Authentication & Initial Data Load
  // -------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate("/auth");
        return;
      }
      if (!mounted) return;
      setUser(authUser);
      setAuthChecked(true);

      // Load dynamic K70 manual pricing from engine settings
      onceApi
        .getAdminSettings()
        .then((s) => {
          if (mounted && s?.single_upload_price_zmw) {
            setManualPriceZmw(Number(s.single_upload_price_zmw));
          }
        })
        .catch(() => {});

      // Fetch live ONCE metadata rules for real-time field validation
      onceApi
        .getMetadataRules()
        .then((rules) => {
          if (mounted && rules?.markdown) {
            setMetadataRules({ markdown: rules.markdown, source: rules.source });
          }
        })
        .catch(() => {});

      // Load unfinished drafts
      onceApi
        .listDrafts()
        .then((list) => {
          if (mounted) setUnfinishedDrafts(list || []);
        })
        .catch(() => {});
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // -------------------------------------------------------------
  // Hydrate from ?id= (edit existing release), ?draftId=, or localStorage
  // -------------------------------------------------------------
  const hydrateFromDraftRecord = useCallback((record: OnceDistributionReleaseRecord) => {
    const meta = (record.metadata || {}) as {
      wizardState?: { form?: Partial<WizardFormState>; tracks?: WizardTrackState[] };
      release?: Partial<OnceReleaseInput>;
      tracks?: Array<Partial<OnceTrackInput>>;
    };

    if (meta.wizardState?.form) {
      setForm((prev) => ({ ...prev, ...meta.wizardState!.form }));
      if (meta.wizardState.form.coverArtFileUrl) {
        setCoverPreview(meta.wizardState.form.coverArtFileUrl);
      }
    } else if (meta.release) {
      const r = meta.release;
      setForm((prev) => ({
        ...prev,
        primaryArtistName: r.primary_artist_name || record.primary_artist || "",
        title: r.title || record.title || "",
        titleVersion: r.title_version || "",
        releaseType: (r.type as "single" | "ep" | "album") || (record.release_type as "single" | "ep" | "album") || "single",
        genre: r.genre || prev.genre,
        subGenre: r.sub_genre || "",
        languageCode: r.audio_language || "en",
        description: r.description || "",
        releaseDate: r.release_date || prev.releaseDate,
        originalReleaseDate: r.original_release_date || "",
        hasOriginalReleaseDate: Boolean(r.original_release_date),
        labelName: r.label || "",
        clineOwner: r.cline_owner || "",
        clineYear: r.cline_year || prev.clineYear,
        plineOwner: r.pline_owner || "",
        plineYear: r.pline_year || prev.plineYear,
        coverArtFileUrl: r.cover_art_file_url || record.cover_art_url || "",
        distributionStoreIds:
          Array.isArray(r.distribution_store_ids)
            ? r.distribution_store_ids
            : record.distribution_store_ids?.length
              ? record.distribution_store_ids
              : prev.distributionStoreIds,
      }));
      if (r.cover_art_file_url || record.cover_art_url) {
        setCoverPreview(r.cover_art_file_url || record.cover_art_url || null);
      }
    }

    if (meta.wizardState?.tracks && meta.wizardState.tracks.length > 0) {
      setTracks(meta.wizardState.tracks.map((t) => ({ ...t, uploading: false })));
    } else if (meta.tracks && meta.tracks.length > 0) {
      setTracks(
        meta.tracks.map((t, idx) => ({
          id: `draft_track_${idx}`,
          title: t.title || "",
          titleVersion: t.title_version || "",
          trackType: t.track_type || "original",
          explicitFlag: Boolean(t.explicit_flag),
          songwriterName: t.writers?.[0]?.name || "",
          extraWritersText: t.writers?.slice(1).map((w) => w.name).join(", ") || "",
          isrc: t.isrc || "",
          lyrics: t.lyrics || "",
          previewStartSeconds: t.preview_start_seconds ?? 15,
          audioFileUrl: t.audio_file_url || "",
          audioFileName: t.audio_metadata?.fileName || (t.audio_file_url ? "Uploaded Audio" : ""),
          audioMetadata: t.audio_metadata,
          uploadProgress: t.audio_file_url ? 100 : 0,
          uploading: false,
        }))
      );
    }

    setLocalDraftId(record.id);
    if (record.once_draft_id) setOnceDraftId(record.once_draft_id);
    setCurrentStep(Math.min(5, Math.max(1, record.current_step || 1)));
    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!authChecked || !user) return;

    const releaseId = searchParams.get("id");
    const draftId = searchParams.get("draftId");

    if (releaseId) {
      setIsEditMode(true);
      setEditingReleaseId(releaseId);
      setIsLoadingRelease(true);
      (async () => {
        const { data, error } = await supabase
          .from("music_releases")
          .select("*")
          .eq("id", releaseId)
          .eq("user_id", user.id)
          .single();

        if (error || !data) {
          toast({
            title: "Release not found",
            description: "We could not load this release for editing.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        setExistingRelease(data);
        const firstLang = Array.isArray(data.language) && data.language[0]
          ? LANGUAGE_NAME_TO_CODE[String(data.language[0]).toLowerCase()] || "en"
          : "en";
        const yr = String(new Date().getFullYear());

        setForm((prev) => ({
          ...prev,
          title: data.title || "",
          primaryArtistName: data.artist_name || "",
          producerName: data.producer_name || "",
          defaultSongwriterName: data.legal_name || "",
          composerName: data.legal_name || "",
          clineOwner: data.legal_name || data.artist_name || "",
          plineOwner: data.legal_name || data.artist_name || "",
          clineYear: yr,
          plineYear: yr,
          releaseType: (data.release_type as "single" | "ep" | "album") || "single",
          genre: data.genre || "Afrobeats",
          languageCode: firstLang,
          releaseDate: data.release_date || prev.releaseDate,
          coverArtFileUrl: data.cover_art_url || "",
          coverArtFileName: data.cover_art_url ? "Existing Cover Art" : "",
          rightsConfirmed: Boolean(data.rights_confirmed),
          distributionMode: "manual_k70",
        }));
        setCoverPreview(data.cover_art_url || null);

        if (data.release_type && data.release_type !== "single") {
          const { data: trackRows } = await supabase
            .from("release_tracks")
            .select("*")
            .eq("release_id", releaseId)
            .order("track_number");
          if (trackRows && trackRows.length > 0) {
            setTracks(
              trackRows.map((tr: any, i: number) => ({
                ...createEmptyTrack(i + 1),
                id: tr.id,
                title: tr.title || "",
                audioFileUrl: tr.audio_url || "",
                audioFileName: tr.audio_url ? "Uploaded Audio" : "",
                songwriterName: data.legal_name || "",
                uploadProgress: tr.audio_url ? 100 : 0,
              }))
            );
          }
        } else {
          setTracks([
            {
              ...createEmptyTrack(1),
              title: data.title || "",
              audioFileUrl: data.audio_url || "",
              audioFileName: data.audio_url ? "Uploaded Audio" : "",
              songwriterName: data.legal_name || "",
              uploadProgress: data.audio_url ? 100 : 0,
            },
          ]);
        }

        setIsLoadingRelease(false);
        hasHydratedRef.current = true;
      })();
      return;
    }

    if (draftId) {
      setIsLoadingRelease(true);
      onceApi
        .getDraft(draftId)
        .then((record) => {
          hydrateFromDraftRecord(record);
          toast({ title: "Draft loaded", description: `Resumed "${record.title}"` });
        })
        .catch(() => {
          toast({ title: "Draft unavailable", description: "Starting a new release.", variant: "destructive" });
          hasHydratedRef.current = true;
        })
        .finally(() => setIsLoadingRelease(false));
      return;
    }

    // Check localStorage backup for uninterrupted progress
    try {
      const savedRaw = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed?.userId === user.id && parsed?.form) {
          setForm((prev) => ({ ...prev, ...parsed.form }));
          if (parsed.form.coverArtFileUrl) setCoverPreview(parsed.form.coverArtFileUrl);
          if (Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
            setTracks(parsed.tracks.map((t: WizardTrackState) => ({ ...t, uploading: false })));
          }
          if (parsed.localDraftId) setLocalDraftId(parsed.localDraftId);
          if (parsed.onceDraftId) setOnceDraftId(parsed.onceDraftId);
          if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        }
      }
    } catch {
      // ignore corrupted local storage
    }
    hasHydratedRef.current = true;
  }, [authChecked, user, searchParams, navigate, toast, hydrateFromDraftRecord]);

  // -------------------------------------------------------------
  // Build Official ONCE Payload From Wizard State
  // -------------------------------------------------------------
  const buildOncePayload = useCallback((): {
    release: OnceReleaseInput;
    tracks: OnceTrackInput[];
  } => {
    const featuredNames = form.featuredArtistsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const releaseContributors: Array<{ name: string; role: string }> = [];
    if (form.producerName.trim()) {
      releaseContributors.push({ name: form.producerName.trim(), role: "Producer" });
    }
    if (form.composerName.trim()) {
      releaseContributors.push({ name: form.composerName.trim(), role: "Composer" });
    }
    for (const fName of featuredNames) {
      releaseContributors.push({ name: fName, role: "Featuring" });
    }

    const release: OnceReleaseInput = {
      title: form.title.trim(),
      ...(form.titleVersion.trim() ? { title_version: form.titleVersion.trim() } : {}),
      primary_artist_name: form.primaryArtistName.trim(),
      primary_artists: form.primaryArtistName.trim()
        ? [
            {
              name: form.primaryArtistName.trim(),
              ...(form.spotifyArtistUrl.trim() ? { spotify_artist_url: form.spotifyArtistUrl.trim() } : {}),
              ...(form.appleMusicArtistUrl.trim() ? { apple_music_artist_url: form.appleMusicArtistUrl.trim() } : {}),
            },
          ]
        : [],
      ...(featuredNames.length > 0 ? { featured_artist_names: featuredNames } : {}),
      type: form.releaseType,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      genre: form.genre,
      ...(form.subGenre ? { sub_genre: form.subGenre } : {}),
      release_date: form.releaseDate,
      ...(form.hasOriginalReleaseDate && form.originalReleaseDate
        ? { original_release_date: form.originalReleaseDate }
        : {}),
      ...(form.labelName.trim() ? { label: form.labelName.trim() } : {}),
      audio_language: form.languageCode,
      metadata_language: form.languageCode === "zxx" ? "en" : form.languageCode,
      distribution_store_ids:
        form.distributionStoreIds && form.distributionStoreIds.length > 0
          ? form.distributionStoreIds
          : [],
      cline_owner: form.clineOwner.trim(),
      cline_year: form.clineYear.trim(),
      pline_owner: form.plineOwner.trim(),
      pline_year: form.plineYear.trim(),
      cover_art_file_url: form.coverArtFileUrl,
      ...(form.coverArtMetadata ? { cover_art_metadata: form.coverArtMetadata } : {}),
      contributors: releaseContributors,
    };

    const preparedTracks: OnceTrackInput[] = tracks.map((t, idx) => {
      const trackTitle =
        form.releaseType === "single" && idx === 0
          ? form.title.trim()
          : t.title.trim();

      const writerNames = [
        t.songwriterName.trim() || form.defaultSongwriterName.trim(),
        ...t.extraWritersText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ].filter(Boolean);

      return {
        title: trackTitle,
        ...(t.titleVersion.trim() ? { title_version: t.titleVersion.trim() } : {}),
        primary_artist_name: form.primaryArtistName.trim(),
        ...(featuredNames.length > 0 ? { featured_artist_names: featuredNames } : {}),
        audio_file_url: t.audioFileUrl,
        explicit_flag: Boolean(t.explicitFlag),
        is_instrumental: form.languageCode === "zxx",
        track_type: t.trackType || "original",
        ...(t.isrc.trim() ? { isrc: t.isrc.trim() } : {}),
        genre: form.genre,
        language: form.languageCode,
        ...(t.lyrics.trim() ? { lyrics: t.lyrics.trim() } : {}),
        preview_start_seconds: Number.isFinite(t.previewStartSeconds) ? t.previewStartSeconds : 15,
        cline_owner: form.clineOwner.trim(),
        cline_year: form.clineYear.trim(),
        pline_owner: form.plineOwner.trim(),
        pline_year: form.plineYear.trim(),
        writers: writerNames.map((name) => ({ name })),
        contributors: releaseContributors,
        ...(t.audioMetadata ? { audio_metadata: t.audioMetadata } : {}),
      };
    });

    return { release, tracks: preparedTracks };
  }, [form, tracks]);

  // -------------------------------------------------------------
  // Auto-Save Draft (LocalStorage + Backend /api/once/drafts)
  // -------------------------------------------------------------
  const saveDraftNow = useCallback(
    async (silent = true) => {
      if (!user || isEditMode || submittedResult) return;

      try {
        localStorage.setItem(
          LOCAL_DRAFT_STORAGE_KEY,
          JSON.stringify({
            userId: user.id,
            localDraftId,
            onceDraftId,
            currentStep,
            form,
            tracks: tracks.map((t) => ({ ...t, uploading: false })),
          })
        );
      } catch {
        // ignore storage quota errors
      }

      // Only hit backend once the artist has entered at least a title or artist name
      if (!form.title.trim() && !form.primaryArtistName.trim() && !form.coverArtFileUrl && !tracks[0]?.audioFileUrl) {
        return;
      }

      setAutoSaveStatus("saving");
      try {
        const { release, tracks: preparedTracks } = buildOncePayload();
        const res = await onceApi.saveDraft({
          release,
          tracks: preparedTracks,
          local_release_id: localDraftId,
          once_draft_id: onceDraftId,
          current_step: currentStep,
          distribution_mode: form.distributionMode,
          wizard_state: {
            form,
            tracks: tracks.map((t) => ({ ...t, uploading: false })),
          },
        });
        if (res.draft?.id && !localDraftId) setLocalDraftId(res.draft.id);
        if (res.onceDraftId) setOnceDraftId(res.onceDraftId);
        setAutoSaveStatus("saved");
        if (!silent) {
          toast({ title: "Draft saved", description: "You can safely leave and resume anytime." });
        }
      } catch {
        setAutoSaveStatus("error");
      }
    },
    [user, isEditMode, submittedResult, localDraftId, onceDraftId, currentStep, form, tracks, buildOncePayload, toast]
  );

  useEffect(() => {
    if (!hasHydratedRef.current || !user || isEditMode || submittedResult) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveDraftNow(true);
    }, 1800);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  }, [form, tracks, currentStep, user, isEditMode, submittedResult, saveDraftNow]);

  // -------------------------------------------------------------
  // Release Type & Track Sync Helpers
  // -------------------------------------------------------------
  const handleReleaseTypeChange = (nextType: "single" | "ep" | "album") => {
    setForm((prev) => ({ ...prev, releaseType: nextType }));
    if (nextType === "single") {
      setTracks((prev) => [
        {
          ...(prev[0] || createEmptyTrack(1)),
          title: form.title,
        },
      ]);
    } else if (nextType === "ep" && tracks.length < 4) {
      setTracks((prev) => {
        const next = [...prev];
        while (next.length < 4) next.push(createEmptyTrack(next.length + 1));
        return next;
      });
    } else if (nextType === "album" && tracks.length < 7) {
      setTracks((prev) => {
        const next = [...prev];
        while (next.length < 7) next.push(createEmptyTrack(next.length + 1));
        return next;
      });
    }
  };

  // -------------------------------------------------------------
  // Cover Art Selection & Verified Upload
  // -------------------------------------------------------------
  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setCoverError(null);
    setCoverValidating(true);

    const check = await inspectAndValidateCoverArt(file, form.distributionMode);
    setCoverValidating(false);

    if (!check.valid || !check.metadata) {
      const msg = check.errors.join(" ");
      setCoverError(msg);
      toast({ title: "Cover art rejected", description: msg, variant: "destructive" });
      e.target.value = "";
      return;
    }

    if (check.warnings.length > 0) {
      toast({ title: "Artwork note", description: check.warnings[0] });
    }

    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
    setCoverUploading(true);
    setCoverUploadProgress(8);

    try {
      const uploaded = await onceApi.uploadAssetWithProgress({
        file,
        type: "coverArt",
        userId: user.id,
        coverArtMetadata: check.metadata,
        onProgress: (pct) => setCoverUploadProgress(pct),
      });

      setForm((prev) => ({
        ...prev,
        coverArtFileUrl: uploaded.fileUrl,
        coverArtFileName: uploaded.fileName,
        coverArtMetadata: check.metadata,
        coverUploadTarget: uploaded.target,
      }));
      setCoverPreview(uploaded.fileUrl);
      toast({
        title: "Cover art verified",
        description: `${check.metadata.width}×${check.metadata.height}px artwork uploaded.`,
      });
    } catch (err: any) {
      const errMsg = err?.message || "Cover art upload failed";
      setCoverError(errMsg);
      toast({ title: "Upload failed", description: errMsg, variant: "destructive" });
    } finally {
      setCoverUploading(false);
    }
  };

  // -------------------------------------------------------------
  // Track Audio Selection, Inspection & Chunked Verified Upload
  // -------------------------------------------------------------
  const handleTrackAudioSelect = async (trackIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setTracks((prev) =>
      prev.map((t, i) => (i === trackIdx ? { ...t, uploadError: undefined, uploading: true, uploadProgress: 5 } : t))
    );

    const check = await inspectAndValidateAudioFile(file);
    if (!check.valid || !check.metadata) {
      const msg = check.errors.join(" ");
      setTracks((prev) =>
        prev.map((t, i) =>
          i === trackIdx ? { ...t, uploading: false, uploadProgress: 0, uploadError: msg } : t
        )
      );
      toast({ title: `Track ${trackIdx + 1} rejected`, description: msg, variant: "destructive" });
      e.target.value = "";
      return;
    }

    if (check.warnings.length > 0) {
      toast({ title: `Track ${trackIdx + 1} audio tip`, description: check.warnings[0] });
    }

    try {
      const uploaded = await onceApi.uploadAssetWithProgress({
        file,
        type: "audio",
        userId: user.id,
        audioMetadata: check.metadata,
        onProgress: (pct) => {
          setTracks((prev) =>
            prev.map((t, i) => (i === trackIdx ? { ...t, uploadProgress: pct } : t))
          );
        },
      });

      setTracks((prev) =>
        prev.map((t, i) =>
          i === trackIdx
            ? {
                ...t,
                audioFileUrl: uploaded.fileUrl,
                audioFileName: uploaded.fileName,
                audioMetadata: check.metadata,
                uploadTarget: uploaded.target,
                uploadProgress: 100,
                uploading: false,
                uploadError: undefined,
              }
            : t
        )
      );
      toast({
        title: `Track ${trackIdx + 1} audio verified`,
        description: `${check.metadata.format} uploaded cleanly.`,
      });
    } catch (err: any) {
      const errMsg = err?.message || "Audio upload failed";
      setTracks((prev) =>
        prev.map((t, i) =>
          i === trackIdx ? { ...t, uploading: false, uploadProgress: 0, uploadError: errMsg } : t
        )
      );
      toast({ title: "Audio upload failed", description: errMsg, variant: "destructive" });
    }
  };

  // -------------------------------------------------------------
  // Step 5: Validation & Quote Runner
  // -------------------------------------------------------------
  const runValidationAndQuote = useCallback(async () => {
    setValidatingReport(true);
    setQuoteNotice(null);
    try {
      const { release, tracks: preparedTracks } = buildOncePayload();
      const report = await onceApi.validateRelease({
        release,
        tracks: preparedTracks,
        distributionMode: form.distributionMode,
      });
      setValidationReport(report);

      if (form.distributionMode === "once_api" && preparedTracks.some((t) => t.audio_file_url)) {
        setQuoteLoading(true);
        try {
          const quote = await onceApi.getReleaseQuote(preparedTracks, localDraftId);
          setQuoteData(quote);
        } catch (qErr: any) {
          setQuoteData(null);
          setQuoteNotice(qErr?.message || "Live ONCE quote unavailable right now.");
        } finally {
          setQuoteLoading(false);
        }
      } else {
        setQuoteData(null);
      }
    } catch (err: any) {
      toast({
        title: "Validation failed",
        description: err?.message || "Could not verify release rules.",
        variant: "destructive",
      });
    } finally {
      setValidatingReport(false);
    }
  }, [buildOncePayload, form.distributionMode, localDraftId, toast]);

  useEffect(() => {
    if (currentStep === 5 && !isEditMode) {
      void runValidationAndQuote();
    }
  }, [currentStep, isEditMode]);

  // -------------------------------------------------------------
  // Step Completion Tracking & Navigation Guards
  // -------------------------------------------------------------
  const completedSteps: number[] = [];
  if (!fieldValidation.hasErrorsOnStep(1)) {
    completedSteps.push(1);
  }
  if (!fieldValidation.hasErrorsOnStep(2)) {
    completedSteps.push(2);
  }
  if (!fieldValidation.hasErrorsOnStep(3) && !coverUploading && tracks.every((t) => !t.uploading)) {
    completedSteps.push(3);
  }
  if (!fieldValidation.hasErrorsOnStep(4)) {
    completedSteps.push(4);
  }
  if (validationReport?.valid && form.rightsConfirmed && (isEditMode || form.submissionConfirmed)) {
    completedSteps.push(5);
  }

  const handleNextStep = () => {
    if (currentStep === 3 && (coverUploading || tracks.some((t) => t.uploading))) {
      toast({
        title: "Upload in progress",
        description: "Wait for your cover art and audio uploads to finish verifying before continuing.",
        variant: "destructive",
      });
      return;
    }

    setStepAttempted((prev) => ({ ...prev, [currentStep]: true }));

    if (fieldValidation.hasErrorsOnStep(currentStep)) {
      const firstStepIssue = fieldValidation.stepFirstErrors[currentStep];
      toast({
        title: "Fix highlighted fields",
        description:
          firstStepIssue?.message ||
          "Please resolve the highlighted ONCE metadata errors on this step before continuing.",
        variant: "destructive",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setCurrentStep((s) => Math.min(5, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // -------------------------------------------------------------
  // Final Submission Handlers (ONCE Automated vs Zedbute Manual K70 vs Edit Mode)
  // -------------------------------------------------------------
  const handleFinalSubmit = async () => {
    if (!user) return;

    if (coverUploading || tracks.some((t) => t.uploading)) {
      toast({ title: "Uploads still finishing", description: "Please wait until all uploads complete.", variant: "destructive" });
      return;
    }

    if (!form.rightsConfirmed) {
      toast({
        title: "Rights confirmation required",
        description: "Please confirm you own or control the distribution rights for this music.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { release, tracks: preparedTracks } = buildOncePayload();

      // Re-run validation before any submission
      const report = await onceApi.validateRelease({
        release,
        tracks: preparedTracks,
        distributionMode: form.distributionMode,
      });
      setValidationReport(report);

      if (!report.valid) {
        toast({
          title: "Fix required issues first",
          description: report.errors[0]?.message || "Incomplete metadata cannot be submitted.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Edit Mode for existing music_releases record
      if (isEditMode && editingReleaseId) {
        const languageLabels = [CODE_TO_ZEDBUTE_LANGUAGE[form.languageCode] || "English"];
        const { error: updErr } = await supabase
          .from("music_releases")
          .update({
            title: form.title.trim(),
            artist_name: form.primaryArtistName.trim(),
            producer_name: form.producerName.trim(),
            legal_name: form.defaultSongwriterName.trim(),
            language: languageLabels,
            genre: form.genre,
            release_date: form.releaseDate,
            cover_art_url: form.coverArtFileUrl || existingRelease?.cover_art_url,
            audio_url: tracks[0]?.audioFileUrl || existingRelease?.audio_url,
            rights_confirmed: form.rightsConfirmed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingReleaseId)
          .eq("user_id", user.id);

        if (updErr) throw updErr;

        if (tracks.length > 0 && form.releaseType !== "single") {
          for (let i = 0; i < tracks.length; i++) {
            const tr = tracks[i];
            if (tr.id && !tr.id.startsWith("track_") && !tr.id.startsWith("draft_")) {
              await supabase.from("release_tracks").update({ title: tr.title }).eq("id", tr.id);
            }
          }
        }

        toast({ title: "Release updated", description: "Your release changes have been saved." });
        navigate("/dashboard");
        return;
      }

      if (!form.submissionConfirmed) {
        toast({
          title: "Confirmation needed",
          description: "Please check the final confirmation box before submitting.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Preserved Zedbute Manual Distribution Workflow (K70 single / EP / Album pricing untouched)
      if (form.distributionMode === "manual_k70") {
        const languageLabels = [CODE_TO_ZEDBUTE_LANGUAGE[form.languageCode] || "English"];
        const { data: insertedRelease, error: insertErr } = await supabase
          .from("music_releases")
          .insert({
            user_id: user.id,
            title: form.title.trim(),
            artist_name: form.primaryArtistName.trim(),
            producer_name: form.producerName.trim(),
            legal_name: form.defaultSongwriterName.trim(),
            language: languageLabels,
            release_type: form.releaseType,
            genre: form.genre,
            release_date: form.releaseDate,
            cover_art_url: form.coverArtFileUrl,
            audio_url: form.releaseType === "single" ? tracks[0]?.audioFileUrl : null,
            rights_confirmed: true,
            status: "unpaid",
            upload_progress: 0,
          })
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        if (form.releaseType !== "single" && insertedRelease?.id) {
          await supabase.from("release_tracks").insert(
            tracks.map((tr, i) => ({
              release_id: insertedRelease.id,
              track_number: i + 1,
              title: tr.title.trim(),
              audio_url: tr.audioFileUrl,
              duration_seconds: tr.audioMetadata?.durationSeconds
                ? Math.round(tr.audioMetadata.durationSeconds)
                : null,
            }))
          );
        }

        // Link draft record to music_releases as pending manual payment
        await onceApi.saveDraft({
          release,
          tracks: preparedTracks,
          local_release_id: localDraftId,
          release_id: insertedRelease.id,
          current_step: 5,
          distribution_mode: "manual_k70",
        }).catch(() => {});

        localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
        const paymentType =
          form.releaseType === "ep" ? "ep" : form.releaseType === "album" ? "album" : "release";
        toast({
          title: "Release saved",
          description: "Redirecting to Mobile Money checkout...",
        });
        navigate(`/payment?type=${paymentType}&releaseId=${insertedRelease.id}`);
        return;
      }

      // Automated ONCE API Submission
      const res = await onceApi.submitRelease({
        release,
        tracks: preparedTracks,
        local_release_id: localDraftId,
        once_draft_id: onceDraftId,
        rights_confirmed: true,
        confirmed: true,
      });

      localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
      setSubmittedResult({
        onceReleaseId: res.onceReleaseId,
        zedbuteRecordId: res.releaseRecord?.id,
        status: res.status || "processing",
        upc: res.upc,
      });
      toast({
        title: "Submitted to ONCE Distribution Engine!",
        description: `ONCE Release ID: ${res.onceReleaseId}`,
      });
    } catch (err: any) {
      if (err?.status === 402 || err?.code === "balance_insufficient") {
        toast({
          title: "Distribution Pending Credits",
          description: "Your payment and upload have been received. Distribution is temporarily pending while our distribution credits are replenished. You do not need to pay again.",
        });
        setSubmitting(false);
        navigate("/dashboard");
        return;
      }
      toast({
        title: "Submission failed",
        description: err?.message || "Could not submit your release.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncSubmittedStatus = async () => {
    if (!submittedResult?.onceReleaseId) return;
    setSyncingStatus(true);
    try {
      const liveStatus = await onceApi.getReleaseStatus(submittedResult.onceReleaseId);
      setSubmittedResult((prev) =>
        prev
          ? {
              ...prev,
              status: liveStatus.aggregateStatus || prev.status,
              liveStatus,
            }
          : prev
      );
      toast({ title: "Status synced", description: `Current ONCE status: ${liveStatus.aggregateStatus}` });
    } catch (err: any) {
      toast({ title: "Status sync error", description: err?.message, variant: "destructive" });
    } finally {
      setSyncingStatus(false);
    }
  };

  const copyCopyrightOwnerFromArtist = () => {
    const owner = form.labelName.trim() || form.defaultSongwriterName.trim() || form.primaryArtistName.trim();
    if (!owner) return;
    setForm((prev) => ({
      ...prev,
      clineOwner: prev.clineOwner || owner,
      plineOwner: prev.plineOwner || owner,
    }));
  };

  if (!authChecked || isLoadingRelease) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeStepMeta =
    UPLOAD_WIZARD_STEPS.find((s) => s.id === currentStep) || UPLOAD_WIZARD_STEPS[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-16">
        {submittedResult ? (
          <Card className="hover:translate-y-0 hover:shadow-card">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-foreground shrink-0" />
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                      Release submitted
                    </h1>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your release "{form.title}" is now tracked inside Zedbute.
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {submittedResult.status}
                </Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ONCE Release ID</p>
                  <p className="font-mono font-medium text-foreground break-all">
                    {submittedResult.onceReleaseId}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Approval & Store Status</p>
                  <p className="font-medium capitalize">{submittedResult.status}</p>
                </div>
                {submittedResult.upc && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">UPC Barcode</p>
                    <p className="font-mono">{submittedResult.upc}</p>
                  </div>
                )}
              </div>

              {submittedResult.liveStatus?.storeStatuses && submittedResult.liveStatus.storeStatuses.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Store Delivery Updates
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {submittedResult.liveStatus.storeStatuses.map((s) => (
                        <div
                          key={s.storeId}
                          className="px-3 py-2.5 rounded-md border border-border flex items-center justify-between text-xs"
                        >
                          <span className="font-medium">{s.storeName}</span>
                          <span className="text-muted-foreground">{s.statusText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSyncSubmittedStatus}
                  disabled={syncingStatus}
                >
                  <RefreshCw className={`h-4 w-4 ${syncingStatus ? "animate-spin" : ""}`} />
                  Refresh status
                </Button>
                <Button type="button" onClick={() => navigate("/dashboard")}>
                  Go to dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
                {isEditMode ? "Edit your release" : "Distribute your release"}
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {isEditMode
                  ? "Update your release details below and save your changes."
                  : "Complete the details below to submit your release for distribution."}
              </p>
            </div>

            <Card className="hover:translate-y-0 hover:shadow-card">
              <CardContent className="p-6 sm:p-8 space-y-8">
                <UploadWizardStepper
                  currentStep={currentStep}
                  completedSteps={completedSteps}
                  stepErrors={fieldValidation.stepErrors}
                  stepAttempted={stepAttempted}
                  onStepSelect={setCurrentStep}
                />

                <Separator />

                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {activeStepMeta.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {activeStepMeta.subtitle}
                  </p>
                </div>

                {/* =========================================================
                    STEP 1: ARTIST DETAILS
                   ========================================================= */}
                {currentStep === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="primaryArtistName">Primary Artist Name *</Label>
                      <Input
                        id="primaryArtistName"
                        value={form.primaryArtistName}
                        onChange={(e) => setForm({ ...form, primaryArtistName: e.target.value })}
                        onBlur={() => markTouched("primaryArtistName")}
                        placeholder="Artist or band name"
                        maxLength={120}
                        aria-invalid={getFieldIssue("primaryArtistName", 1)?.severity === "error"}
                        className={fieldInputClass("primaryArtistName", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("primaryArtistName", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="featuredArtistsText">Featured Artists</Label>
                      <Input
                        id="featuredArtistsText"
                        value={form.featuredArtistsText}
                        onChange={(e) => setForm({ ...form, featuredArtistsText: e.target.value })}
                        onBlur={() => markTouched("featuredArtistsText")}
                        placeholder="Yo Maps, Chef 187"
                        aria-invalid={getFieldIssue("featuredArtistsText", 1)?.severity === "error"}
                        className={fieldInputClass("featuredArtistsText", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("featuredArtistsText", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="songwriter">Songwriter Full Name *</Label>
                      <Input
                        id="songwriter"
                        value={form.defaultSongwriterName}
                        onChange={(e) => setForm({ ...form, defaultSongwriterName: e.target.value })}
                        onBlur={() => markTouched("defaultSongwriterName")}
                        placeholder="Chanda Mwamba"
                        aria-invalid={getFieldIssue("defaultSongwriterName", 1)?.severity === "error"}
                        className={fieldInputClass("defaultSongwriterName", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("defaultSongwriterName", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="composer">Composer Full Name *</Label>
                      <Input
                        id="composer"
                        value={form.composerName}
                        onChange={(e) => setForm({ ...form, composerName: e.target.value })}
                        onBlur={() => markTouched("composerName")}
                        placeholder="Full legal name"
                        aria-invalid={getFieldIssue("composerName", 1)?.severity === "error"}
                        className={fieldInputClass("composerName", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("composerName", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="producer">Producer *</Label>
                      <Input
                        id="producer"
                        value={form.producerName}
                        onChange={(e) => setForm({ ...form, producerName: e.target.value })}
                        onBlur={() => markTouched("producerName")}
                        placeholder="Producer name"
                        aria-invalid={getFieldIssue("producerName", 1)?.severity === "error"}
                        className={fieldInputClass("producerName", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("producer", 1) || getFieldIssue("producerName", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="labelName">Record Label</Label>
                      <Input
                        id="labelName"
                        value={form.labelName}
                        onChange={(e) => setForm({ ...form, labelName: e.target.value })}
                        onBlur={() => markTouched("labelName")}
                        placeholder="Label or independent"
                        aria-invalid={getFieldIssue("labelName", 1)?.severity === "error"}
                        className={fieldInputClass("labelName", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("labelName", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="spotifyUrl">Spotify Artist URL</Label>
                      <Input
                        id="spotifyUrl"
                        value={form.spotifyArtistUrl}
                        onChange={(e) => setForm({ ...form, spotifyArtistUrl: e.target.value })}
                        onBlur={() => markTouched("spotifyArtistUrl")}
                        placeholder="https://open.spotify.com/artist/..."
                        aria-invalid={getFieldIssue("spotifyArtistUrl", 1)?.severity === "error"}
                        className={fieldInputClass("spotifyArtistUrl", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("spotifyArtistUrl", 1)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appleUrl">Apple Music Artist URL</Label>
                      <Input
                        id="appleUrl"
                        value={form.appleMusicArtistUrl}
                        onChange={(e) => setForm({ ...form, appleMusicArtistUrl: e.target.value })}
                        onBlur={() => markTouched("appleMusicArtistUrl")}
                        placeholder="https://music.apple.com/artist/..."
                        aria-invalid={getFieldIssue("appleMusicArtistUrl", 1)?.severity === "error"}
                        className={fieldInputClass("appleMusicArtistUrl", 1, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("appleMusicArtistUrl", 1)} />
                    </div>
                  </div>
                )}

                {/* =========================================================
                    STEP 2: RELEASE INFORMATION, TRACKLIST & COPYRIGHT
                   ========================================================= */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="releaseTitle">Release Title *</Label>
                        <Input
                          id="releaseTitle"
                          value={form.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((prev) => ({ ...prev, title: val }));
                            if (form.releaseType === "single") {
                              setTracks((prev) => prev.map((t, i) => (i === 0 ? { ...t, title: val } : t)));
                            }
                          }}
                          onBlur={() => markTouched("title")}
                          placeholder="Exact title of your release"
                          aria-invalid={getFieldIssue("title", 2)?.severity === "error"}
                          className={fieldInputClass("title", 2, "")}
                        />
                        <FieldValidationMessage issue={getFieldIssue("title", 2)} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="titleVersion">Title Version</Label>
                        <Input
                          id="titleVersion"
                          value={form.titleVersion}
                          onChange={(e) => setForm({ ...form, titleVersion: e.target.value })}
                          onBlur={() => markTouched("titleVersion")}
                          placeholder="Remix, Acoustic, Live"
                          aria-invalid={getFieldIssue("titleVersion", 2)?.severity === "error"}
                          className={fieldInputClass("titleVersion", 2, "")}
                        />
                        <FieldValidationMessage issue={getFieldIssue("titleVersion", 2)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Release Type *</Label>
                        <Select
                          value={form.releaseType}
                          disabled={isEditMode}
                          onValueChange={(v) => handleReleaseTypeChange(v as "single" | "ep" | "album")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single (1 track)</SelectItem>
                            <SelectItem value="ep">EP (4–6 tracks)</SelectItem>
                            <SelectItem value="album">Album (7+ tracks)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Primary Language *</Label>
                        <Select
                          value={form.languageCode}
                          onValueChange={(v) => {
                            setForm({ ...form, languageCode: v });
                            markTouched("languageCode");
                          }}
                        >
                          <SelectTrigger className={fieldInputClass("languageCode", 2, "")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ONCE_LANGUAGE_OPTIONS.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldValidationMessage issue={getFieldIssue("languageCode", 2)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Primary Genre *</Label>
                        <Select
                          value={form.genre}
                          onValueChange={(v) => {
                            setForm({ ...form, genre: v });
                            markTouched("genre");
                          }}
                        >
                          <SelectTrigger className={fieldInputClass("genre", 2, "")}>
                            <SelectValue placeholder="Choose genre" />
                          </SelectTrigger>
                          <SelectContent>
                            {ONCE_GENRE_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldValidationMessage issue={getFieldIssue("genre", 2)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Secondary Genre</Label>
                        <Select
                          value={form.subGenre || "__none__"}
                          onValueChange={(v) => setForm({ ...form, subGenre: v === "__none__" ? "" : v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Optional sub-genre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {ONCE_SUBGENRE_OPTIONS.map((sg) => (
                              <SelectItem key={sg} value={sg}>{sg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="releaseDate">Target Release Date *</Label>
                        <Input
                          id="releaseDate"
                          type="date"
                          value={form.releaseDate}
                          onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                          onBlur={() => markTouched("releaseDate")}
                          aria-invalid={getFieldIssue("releaseDate", 2)?.severity === "error"}
                          className={fieldInputClass("releaseDate", 2, "")}
                        />
                        <FieldValidationMessage issue={getFieldIssue("releaseDate", 2)} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="origReleaseToggle">Previously Released?</Label>
                          <Switch
                            id="origReleaseToggle"
                            checked={form.hasOriginalReleaseDate}
                            onCheckedChange={(checked) => {
                              setForm((prev) => ({
                                ...prev,
                                hasOriginalReleaseDate: checked,
                                originalReleaseDate: checked ? prev.originalReleaseDate : "",
                              }));
                              if (checked) markTouched("originalReleaseDate");
                            }}
                          />
                        </div>
                        {form.hasOriginalReleaseDate ? (
                          <>
                            <Input
                              type="date"
                              value={form.originalReleaseDate}
                              max={new Date().toISOString().slice(0, 10)}
                              onChange={(e) => setForm({ ...form, originalReleaseDate: e.target.value })}
                              onBlur={() => markTouched("originalReleaseDate")}
                              aria-invalid={getFieldIssue("originalReleaseDate", 2)?.severity === "error"}
                              className={fieldInputClass("originalReleaseDate", 2, "")}
                            />
                            <FieldValidationMessage issue={getFieldIssue("originalReleaseDate", 2)} />
                          </>
                        ) : (
                          <div className="h-10 rounded-md border border-dashed border-border px-3 flex items-center text-xs text-muted-foreground">
                            New release
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="releaseDesc">Release Description</Label>
                        <Textarea
                          id="releaseDesc"
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          onBlur={() => markTouched("description")}
                          placeholder="Optional background notes for reviewers or playlist curators"
                          rows={3}
                          aria-invalid={getFieldIssue("description", 2)?.severity === "error"}
                          className={fieldInputClass("description", 2, "")}
                        />
                        <FieldValidationMessage issue={getFieldIssue("description", 2)} />
                      </div>
                    </div>

                    <Separator />

                    {/* Tracklist Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Tracklist ({tracks.length})</h3>
                        {form.releaseType !== "single" && !isEditMode && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setTracks((prev) => [...prev, createEmptyTrack(prev.length + 1)])}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add track
                          </Button>
                        )}
                      </div>
                      <FieldValidationMessage issue={getFieldIssue("tracklist", 2)} />

                      <div className="space-y-6">
                        {tracks.map((tr, idx) => {
                          const titleKey = `tracks.${idx}.title`;
                          const isrcKey = `tracks.${idx}.isrc`;
                          return (
                            <div
                              key={tr.id}
                              className={idx > 0 ? "pt-6 border-t border-border space-y-4" : "space-y-4"}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Track {idx + 1}
                                </span>
                                {form.releaseType !== "single" && tracks.length > 1 && !isEditMode && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                    onClick={() => setTracks((prev) => prev.filter((_, i) => i !== idx))}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Track Title *</Label>
                                  <Input
                                    value={form.releaseType === "single" && idx === 0 ? form.title : tr.title}
                                    disabled={form.releaseType === "single" && idx === 0}
                                    onChange={(e) =>
                                      setTracks((prev) =>
                                        prev.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item))
                                      )
                                    }
                                    onBlur={() => markTouched(titleKey)}
                                    placeholder="Track title"
                                    aria-invalid={getFieldIssue(titleKey, 2)?.severity === "error"}
                                    className={fieldInputClass(titleKey, 2, "")}
                                  />
                                  <FieldValidationMessage issue={getFieldIssue(titleKey, 2)} />
                                </div>

                                <div className="space-y-2">
                                  <Label>Recording Origin *</Label>
                                  <Select
                                    value={tr.trackType}
                                    onValueChange={(v) =>
                                      setTracks((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, trackType: v as "original" | "cover" | "public_domain" } : item
                                        )
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="original">Original Recording</SelectItem>
                                      <SelectItem value="cover">Cover Song</SelectItem>
                                      <SelectItem value="public_domain">Public Domain</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label>Explicit Content *</Label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      type="button"
                                      variant={!tr.explicitFlag ? "default" : "outline"}
                                      onClick={() =>
                                        setTracks((prev) =>
                                          prev.map((item, i) => (i === idx ? { ...item, explicitFlag: false } : item))
                                        )
                                      }
                                    >
                                      Clean
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={tr.explicitFlag ? "destructive" : "outline"}
                                      onClick={() =>
                                        setTracks((prev) =>
                                          prev.map((item, i) => (i === idx ? { ...item, explicitFlag: true } : item))
                                        )
                                      }
                                    >
                                      Explicit
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>ISRC (optional)</Label>
                                  <Input
                                    value={tr.isrc}
                                    onChange={(e) =>
                                      setTracks((prev) =>
                                        prev.map((item, i) => (i === idx ? { ...item, isrc: e.target.value } : item))
                                      )
                                    }
                                    onBlur={() => markTouched(isrcKey)}
                                    placeholder="Auto-assigned if blank"
                                    aria-invalid={getFieldIssue(isrcKey, 2)?.severity === "error"}
                                    className={fieldInputClass(isrcKey, 2, "font-mono")}
                                  />
                                  <FieldValidationMessage issue={getFieldIssue(isrcKey, 2)} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Copyright Section */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Copyright Ownership (C-Line & P-Line) *</h3>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={copyCopyrightOwnerFromArtist}
                        >
                          Use artist or label name
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-3 space-y-2">
                          <Label>C-Line Copyright Owner *</Label>
                          <Input
                            value={form.clineOwner}
                            onChange={(e) => setForm({ ...form, clineOwner: e.target.value })}
                            onBlur={() => markTouched("clineOwner")}
                            placeholder="Legal owner or label name"
                            aria-invalid={getFieldIssue("clineOwner", 2)?.severity === "error"}
                            className={fieldInputClass("clineOwner", 2, "")}
                          />
                          <FieldValidationMessage issue={getFieldIssue("clineOwner", 2)} />
                        </div>
                        <div className="space-y-2">
                          <Label>C-Line Year *</Label>
                          <Input
                            value={form.clineYear}
                            onChange={(e) => setForm({ ...form, clineYear: e.target.value })}
                            onBlur={() => markTouched("clineYear")}
                            placeholder="2026"
                            maxLength={4}
                            aria-invalid={getFieldIssue("clineYear", 2)?.severity === "error"}
                            className={fieldInputClass("clineYear", 2, "")}
                          />
                          <FieldValidationMessage issue={getFieldIssue("clineYear", 2)} />
                        </div>
                        <div className="sm:col-span-3 space-y-2">
                          <Label>P-Line Master Owner *</Label>
                          <Input
                            value={form.plineOwner}
                            onChange={(e) => setForm({ ...form, plineOwner: e.target.value })}
                            onBlur={() => markTouched("plineOwner")}
                            placeholder="Master recording owner or label"
                            aria-invalid={getFieldIssue("plineOwner", 2)?.severity === "error"}
                            className={fieldInputClass("plineOwner", 2, "")}
                          />
                          <FieldValidationMessage issue={getFieldIssue("plineOwner", 2)} />
                        </div>
                        <div className="space-y-2">
                          <Label>P-Line Year *</Label>
                          <Input
                            value={form.plineYear}
                            onChange={(e) => setForm({ ...form, plineYear: e.target.value })}
                            onBlur={() => markTouched("plineYear")}
                            placeholder="2026"
                            maxLength={4}
                            aria-invalid={getFieldIssue("plineYear", 2)?.severity === "error"}
                            className={fieldInputClass("plineYear", 2, "")}
                          />
                          <FieldValidationMessage issue={getFieldIssue("plineYear", 2)} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    STEP 3: AUDIO & COVER ART UPLOADS
                   ========================================================= */}
                {currentStep === 3 && (
                  <div className="space-y-8">
                    {/* Cover Art */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm font-semibold">Cover Artwork *</Label>
                        {form.coverArtFileUrl && !coverUploading && (
                          <span className="text-xs font-medium text-foreground">
                            Verified
                          </span>
                        )}
                      </div>

                      <div className="rounded-lg border border-dashed border-border p-6 text-center bg-muted/20">
                        {coverPreview ? (
                          <div className="space-y-3">
                            <img
                              src={coverPreview}
                              alt="Cover art preview"
                              className="mx-auto w-44 h-44 object-cover rounded-lg border border-border"
                            />
                            {form.coverArtMetadata && (
                              <p className="text-xs text-muted-foreground">
                                {form.coverArtMetadata.width}x{form.coverArtMetadata.height} px,{" "}
                                {(form.coverArtMetadata.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                            {coverUploading && (
                              <div className="max-w-xs mx-auto space-y-1.5">
                                <Progress value={coverUploadProgress} className="h-1.5" />
                                <p className="text-xs text-muted-foreground">Uploading {coverUploadProgress}%</p>
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={coverUploading}
                              onClick={() => coverInputRef.current?.click()}
                            >
                              Replace artwork
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3 py-2">
                            <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
                            <div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={coverValidating || coverUploading}
                                onClick={() => coverInputRef.current?.click()}
                              >
                                {coverValidating ? "Checking image" : "Select square JPG or PNG"}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {CLIENT_COVER_SPECS.acceptedFormatsLabel}, max 50 MB, 1:1 square
                            </p>
                          </div>
                        )}
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept={CLIENT_COVER_SPECS.acceptAttr}
                          onChange={handleCoverFileSelect}
                          className="hidden"
                        />
                      </div>

                      {coverError ? (
                        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{coverError}</span>
                        </div>
                      ) : (
                        <FieldValidationMessage issue={getFieldIssue("coverArtFileUrl", 3)} />
                      )}
                    </div>

                    <Separator />

                    {/* Master Audio Files */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Master Audio Files *</Label>
                        <p className="text-xs text-muted-foreground">
                          {CLIENT_AUDIO_SPECS.acceptedFormatsLabel} (44.1 kHz, 16-bit+)
                        </p>
                      </div>

                      <div className="space-y-3">
                        {tracks.map((tr, idx) => (
                          <div
                            key={tr.id}
                            className="p-4 rounded-lg border border-border bg-background space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-sm">
                                {idx + 1}. {form.releaseType === "single" && idx === 0 ? form.title || "Single Track" : tr.title || `Track ${idx + 1}`}
                              </span>
                              {tr.audioFileUrl && !tr.uploading ? (
                                <span className="text-xs font-medium text-foreground">
                                  Audio verified
                                </span>
                              ) : tr.uploading ? (
                                <span className="text-xs font-medium text-primary">
                                  Uploading {tr.uploadProgress}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Awaiting file</span>
                              )}
                            </div>

                            {tr.uploading && (
                              <Progress value={tr.uploadProgress} className="h-1.5" />
                            )}

                            {tr.audioFileUrl && !tr.uploading && (
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium text-foreground truncate">
                                  {tr.audioFileName || "Uploaded Audio"}
                                </p>
                                {tr.audioMetadata && (
                                  <p className="mt-0.5">
                                    {[
                                      tr.audioMetadata.format,
                                      tr.audioMetadata.sampleRateHz
                                        ? `${(tr.audioMetadata.sampleRateHz / 1000).toFixed(1)} kHz`
                                        : null,
                                      tr.audioMetadata.bitDepth ? `${tr.audioMetadata.bitDepth}-bit` : null,
                                      tr.audioMetadata.durationSeconds
                                        ? formatDurationMmSs(tr.audioMetadata.durationSeconds)
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>
                            )}

                            {tr.uploadError ? (
                              <div className="p-2.5 rounded-md border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{tr.uploadError}</span>
                              </div>
                            ) : (
                              <FieldValidationMessage issue={getFieldIssue(`tracks.${idx}.audioFileUrl`, 3)} />
                            )}

                            <label className="inline-flex">
                              <input
                                type="file"
                                accept={CLIENT_AUDIO_SPECS.acceptAttr}
                                onChange={(e) => handleTrackAudioSelect(idx, e)}
                                className="hidden"
                                disabled={tr.uploading}
                              />
                              <Button type="button" variant="outline" size="sm" asChild>
                                <span className="cursor-pointer">
                                  <Upload className="h-3.5 w-3.5" />
                                  {tr.audioFileUrl ? "Replace audio file" : "Choose audio file"}
                                </span>
                              </Button>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    STEP 4: DISTRIBUTION STORES & WORKFLOW
                   ========================================================= */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <StoreSelector
                        selectedStoreIds={form.distributionStoreIds}
                        onChange={(ids) => {
                          setForm({ ...form, distributionStoreIds: ids });
                          markTouched("distributionStoreIds");
                        }}
                        languageCode={form.languageCode}
                      />
                      <FieldValidationMessage issue={getFieldIssue("distributionStoreIds", 4)} />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="step4ReleaseDate">Confirm Go-Live Release Date *</Label>
                      <Input
                        id="step4ReleaseDate"
                        type="date"
                        value={form.releaseDate}
                        onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                        onBlur={() => markTouched("step4ReleaseDate")}
                        aria-invalid={getFieldIssue("step4ReleaseDate", 4)?.severity === "error"}
                        className={fieldInputClass("step4ReleaseDate", 4, "")}
                      />
                      <FieldValidationMessage issue={getFieldIssue("step4ReleaseDate", 4)} />
                    </div>

                    {!isEditMode && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">Distribution Workflow *</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, distributionMode: "once_api" })}
                              className={`p-4 rounded-lg border text-left space-y-1.5 transition-colors ${
                                form.distributionMode === "once_api"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">ONCE Automated API</span>
                                <span className="text-xs font-medium text-primary">Automated</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Direct submission to ONCE (1 credit human, 2 credits AI) with live tracking.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setForm({ ...form, distributionMode: "manual_k70" })}
                              className={`p-4 rounded-lg border text-left space-y-1.5 transition-colors ${
                                form.distributionMode === "manual_k70"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">Zedbute Standard (K{manualPriceZmw})</span>
                                <span className="text-xs text-muted-foreground">Mobile Money</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Pay in Kwacha via MTN MoMo or Airtel Money (K{manualPriceZmw} single / EP / Album).
                              </p>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* =========================================================
                    STEP 5: VALIDATE, QUOTE & SUBMIT
                   ========================================================= */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 pb-5 border-b border-border">
                      {coverPreview ? (
                        <img
                          src={coverPreview}
                          alt="Cover"
                          className="w-16 h-16 rounded-lg object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs text-muted-foreground">
                          Art
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                        <p className="font-semibold text-base truncate">{form.title || "Untitled Release"}</p>
                        <p className="text-muted-foreground truncate">
                          {form.primaryArtistName || "No artist"} / {form.releaseType.toUpperCase()} / {form.genre}
                        </p>
                        <p className="text-muted-foreground">
                          {tracks.length} track(s), {form.distributionStoreIds.length} stores, release {form.releaseDate}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={runValidationAndQuote}
                        disabled={validatingReport}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${validatingReport ? "animate-spin" : ""}`} />
                        Re-check
                      </Button>
                    </div>

                    <MetadataValidationBanner
                      report={validationReport}
                      loading={validatingReport}
                      onJumpToField={(field) => {
                        const targetStep = fieldToStep(field);
                        setStepAttempted((prev) => ({ ...prev, [targetStep]: true }));
                        setCurrentStep(targetStep);
                      }}
                    />

                    {!isEditMode && form.distributionMode === "once_api" ? (
                      <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Release Credit Quote</span>
                          {quoteLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>

                        {quoteData ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                              <p className="text-muted-foreground">Release Cost</p>
                              <p className="font-semibold text-sm">
                                {quoteData.cost?.totalCredits ?? tracks.length} Credit(s) ($
                                {quoteData.cost?.totalUsd ?? tracks.length})
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Available Balance</p>
                              <p className="font-semibold text-sm">
                                {quoteData.accountCredits ??
                                  (quoteData.balance as any)?.available ??
                                  quoteData.balance?.currentCredits ??
                                  0}{" "}
                                Credits
                              </p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <p className="text-muted-foreground">Status</p>
                              <p
                                className={`font-semibold text-sm ${
                                  quoteData.balance?.covered ? "text-foreground" : "text-destructive"
                                }`}
                              >
                                {quoteData.balance?.covered ? "Covered" : "Insufficient Credits"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            {quoteNotice ||
                              "Human songs cost 1 ONCE credit ($1) and AI-detected tracks cost 2 credits ($2)."}
                          </p>
                        )}
                      </div>
                    ) : !isEditMode ? (
                      <div className="p-4 rounded-lg border border-border bg-muted/20 text-xs space-y-1">
                        <p className="font-semibold text-foreground">
                          Zedbute Standard Distribution Fee: K
                          {form.releaseType === "ep" ? 200 : form.releaseType === "album" ? 500 : manualPriceZmw}
                        </p>
                        <p className="text-muted-foreground">
                          After confirming, your release will be saved and you will complete payment via MTN MoMo or Airtel Money.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-3 pt-1">
                      <div>
                        <div className="flex items-start space-x-3 rounded-lg border border-border p-4">
                          <Checkbox
                            id="rightsConfirmed"
                            checked={form.rightsConfirmed}
                            onCheckedChange={(checked) => {
                              setForm({ ...form, rightsConfirmed: Boolean(checked) });
                              markTouched("rightsConfirmed");
                            }}
                          />
                          <div className="space-y-1">
                            <Label htmlFor="rightsConfirmed" className="cursor-pointer font-medium text-sm">
                              I own or control all rights to distribute this release *
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              I confirm all samples, covers, and audio stems are cleared and all contributor credits are accurate.
                            </p>
                          </div>
                        </div>
                        <FieldValidationMessage issue={getFieldIssue("rightsConfirmed", 5)} />
                      </div>

                      {!isEditMode && (
                        <div>
                          <div className="flex items-start space-x-3 rounded-lg border border-border p-4">
                            <Checkbox
                              id="submissionConfirmed"
                              checked={form.submissionConfirmed}
                              onCheckedChange={(checked) => {
                                setForm({ ...form, submissionConfirmed: Boolean(checked) });
                                markTouched("submissionConfirmed");
                              }}
                            />
                            <div className="space-y-1">
                              <Label htmlFor="submissionConfirmed" className="cursor-pointer font-medium text-sm">
                                Confirm release metadata and submit for distribution *
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {form.distributionMode === "once_api"
                                  ? "Submitting dispatches this release to ONCE for store delivery."
                                  : "Submitting saves this release and proceeds to Zedbute Mobile Money checkout."}
                              </p>
                            </div>
                          </div>
                          <FieldValidationMessage issue={getFieldIssue("submissionConfirmed", 5)} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bottom Step Navigation */}
            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (currentStep === 1) navigate("/dashboard");
                  else {
                    setCurrentStep((s) => Math.max(1, s - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                {currentStep === 1 ? "Cancel" : "Previous step"}
              </Button>

              {currentStep < 5 ? (
                <Button type="button" onClick={handleNextStep}>
                  Next step
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={
                    submitting ||
                    validatingReport ||
                    (validationReport !== null && !validationReport.valid) ||
                    !form.rightsConfirmed ||
                    (!isEditMode && !form.submissionConfirmed)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEditMode ? "Saving..." : "Submitting..."}
                    </>
                  ) : isEditMode ? (
                    "Save changes"
                  ) : form.distributionMode === "once_api" ? (
                    "Submit release"
                  ) : (
                    `Continue to K${form.releaseType === "ep" ? 200 : form.releaseType === "album" ? 500 : manualPriceZmw} payment`
                  )}
                </Button>
              )}
            </div>

            {!isEditMode && unfinishedDrafts.length > 0 && (
              <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span>Saved drafts:</span>
                  {unfinishedDrafts.slice(0, 3).map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => hydrateFromDraftRecord(d)}
                        className={`underline-offset-4 hover:underline ${
                          localDraftId === d.id ? "text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {d.title || "Untitled Draft"}
                      </button>
                      {["draft", "pending_submission"].includes(d.status) && (
                        <button
                          type="button"
                          aria-label={`Delete draft ${d.title || "Untitled"}`}
                          onClick={async () => {
                            await onceApi.deleteDraft(d.id).catch(() => {});
                            setUnfinishedDrafts((prev) => prev.filter((item) => item.id !== d.id));
                            if (localDraftId === d.id) setLocalDraftId(undefined);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => saveDraftNow(false)}
                  className="text-primary hover:underline font-medium"
                >
                  {autoSaveStatus === "saving" ? "Saving..." : "Save progress"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}