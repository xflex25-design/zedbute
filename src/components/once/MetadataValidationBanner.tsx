import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ValidationReport } from "../../../server/once/types";

interface MetadataValidationBannerProps {
  report: ValidationReport | null;
  loading?: boolean;
  onJumpToField?: (field: string) => void;
}

export function MetadataValidationBanner({
  report,
  loading,
  onJumpToField,
}: MetadataValidationBannerProps) {
  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4 animate-pulse text-primary shrink-0" />
        <span>Checking release metadata against official ONCE rules & release schema...</span>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const allValid = report.valid && report.errors.length === 0;

  return (
    <div
      className={`p-4 rounded-xl border text-xs space-y-3 ${
        allValid
          ? "border-emerald-500/35 bg-emerald-500/10"
          : "border-destructive/40 bg-destructive/10"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {allValid ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-emerald-700 dark:text-emerald-300">
                Ready for ONCE Distribution — All Required Rules Passed
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-destructive">
                {report.errors.length} {report.errors.length === 1 ? "issue needs" : "issues need"} fixing before submission
              </span>
            </>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          Rules: {report.rulesSource === "live" ? "Live ONCE API" : "ONCE v1 Spec"} · Schema:{" "}
          {report.schemaSource === "live" ? "Live ONCE Schema" : "ONCE OpenAPI v1"}
        </span>
      </div>

      {report.errors.length > 0 && (
        <ul className="space-y-1.5">
          {report.errors.map((err, idx) => (
            <li
              key={`${err.field}-${idx}`}
              className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background/80 border border-destructive/20"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{err.message}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{err.field}</p>
                </div>
              </div>
              {onJumpToField && (
                <button
                  type="button"
                  onClick={() => onJumpToField(err.field)}
                  className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                >
                  Fix
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {report.warnings.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Non-blocking recommendations ({report.warnings.length})
          </p>
          <ul className="space-y-1">
            {report.warnings.map((warn, idx) => (
              <li
                key={`${warn.field}-w-${idx}`}
                className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200"
              >
                {warn.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
