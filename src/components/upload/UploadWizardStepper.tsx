import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: number;
  shortTitle: string;
  title: string;
  subtitle: string;
}

export const UPLOAD_WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    shortTitle: "Artist",
    title: "Artist details",
    subtitle: "Enter your performing name and credits for this release.",
  },
  {
    id: 2,
    shortTitle: "Release",
    title: "Release details",
    subtitle: "Add your title, genre, tracklist, and ownership information.",
  },
  {
    id: 3,
    shortTitle: "Media",
    title: "Audio & artwork",
    subtitle: "Upload your square cover artwork and master audio files.",
  },
  {
    id: 4,
    shortTitle: "Stores",
    title: "Distribution stores",
    subtitle: "Choose where your music should be delivered and when it goes live.",
  },
  {
    id: 5,
    shortTitle: "Submit",
    title: "Review & submit",
    subtitle: "Confirm your release information and complete your submission.",
  },
];

interface UploadWizardStepperProps {
  currentStep: number;
  completedSteps: number[];
  stepErrors?: Record<number, number>;
  stepAttempted?: Record<number, boolean>;
  onStepSelect: (step: number) => void;
}

export function UploadWizardStepper({
  currentStep,
  completedSteps,
  stepErrors,
  stepAttempted,
  onStepSelect,
}: UploadWizardStepperProps) {
  return (
    <div className="pb-6 border-b border-border">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {UPLOAD_WIZARD_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isDone = completedSteps.includes(step.id) && step.id < currentStep;
          const errorCount = stepErrors?.[step.id] || 0;
          const hasStepErrors = Boolean(stepAttempted?.[step.id]) && errorCount > 0;
          const isLast = index === UPLOAD_WIZARD_STEPS.length - 1;

          const barFill =
            step.id < currentStep
              ? "w-full"
              : isCurrent
                ? "w-1/2"
                : "w-0";

          return (
            <div
              key={step.id}
              className={cn("flex items-center", isLast ? "shrink-0" : "flex-1")}
            >
              <button
                type="button"
                onClick={() => onStepSelect(step.id)}
                aria-label={`Step ${step.id}: ${step.title}`}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "h-8 w-8 rounded-full text-xs font-medium flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  hasStepErrors
                    ? "bg-destructive text-destructive-foreground"
                    : isCurrent || isDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {hasStepErrors ? "!" : isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : step.id}
              </button>

              {!isLast && (
                <div className="flex-1 h-1.5 mx-2 sm:mx-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      hasStepErrors ? "bg-destructive" : "bg-primary",
                      barFill
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
