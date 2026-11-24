import { Check, Loader2, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: number;
  shortTitle: string;
  title: string;
}

export const UPLOAD_WIZARD_STEPS: WizardStep[] = [
  { id: 1, shortTitle: "Artist", title: "Artist & Credits" },
  { id: 2, shortTitle: "Release", title: "Release & Copyright" },
  { id: 3, shortTitle: "Media", title: "Audio & Cover Art" },
  { id: 4, shortTitle: "Stores", title: "Distribution & Stores" },
  { id: 5, shortTitle: "Submit", title: "Validate & Submit" },
];

interface UploadWizardStepperProps {
  currentStep: number;
  completedSteps: number[];
  stepErrors?: Record<number, number>;
  stepAttempted?: Record<number, boolean>;
  onStepSelect: (step: number) => void;
  autoSaveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: string | null;
}

export function UploadWizardStepper({
  currentStep,
  completedSteps,
  stepErrors,
  stepAttempted,
  onStepSelect,
  autoSaveStatus,
  lastSavedAt,
}: UploadWizardStepperProps) {
  const pct = Math.round((currentStep / UPLOAD_WIZARD_STEPS.length) * 100);

  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="font-medium text-muted-foreground">
          Step {currentStep} of {UPLOAD_WIZARD_STEPS.length}:{" "}
          <span className="text-foreground font-semibold">
            {UPLOAD_WIZARD_STEPS.find((s) => s.id === currentStep)?.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {autoSaveStatus === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Saving draft...</span>
            </>
          ) : autoSaveStatus === "saved" ? (
            <>
              <Cloud className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                Draft auto-saved{lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            </>
          ) : autoSaveStatus === "error" ? (
            <span className="text-amber-500">Saved locally on device</span>
          ) : (
            <span>Auto-save active</span>
          )}
        </div>
      </div>

      {/* Slim mobile progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Responsive 5-step pills */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {UPLOAD_WIZARD_STEPS.map((step) => {
          const isCurrent = step.id === currentStep;
          const isDone = completedSteps.includes(step.id);
          const errorCount = stepErrors?.[step.id] || 0;
          const hasStepErrors = Boolean(stepAttempted?.[step.id]) && errorCount > 0;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepSelect(step.id)}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 p-2 rounded-lg border text-center sm:text-left transition-all",
                isCurrent
                  ? hasStepErrors
                    ? "border-destructive bg-destructive/10 text-foreground shadow-sm"
                    : "border-primary bg-primary/10 text-foreground shadow-sm"
                  : hasStepErrors
                    ? "border-destructive/50 bg-destructive/5 text-foreground hover:bg-destructive/10"
                    : isDone
                      ? "border-emerald-500/40 bg-emerald-500/5 text-foreground hover:bg-emerald-500/10"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0",
                  isCurrent
                    ? hasStepErrors
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                    : hasStepErrors
                      ? "bg-destructive text-destructive-foreground"
                      : isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                )}
              >
                {hasStepErrors ? "!" : isDone && !isCurrent ? <Check className="h-3 w-3" /> : step.id}
              </span>
              <span className="text-[11px] sm:text-xs font-medium truncate w-full sm:w-auto">
                {step.shortTitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
