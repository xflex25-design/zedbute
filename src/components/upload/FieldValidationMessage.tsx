import { AlertCircle, Info } from "lucide-react";

export interface FieldValidationIssue {
  severity: "error" | "warning";
  message: string;
  code: string;
}

interface FieldValidationMessageProps {
  issue?: FieldValidationIssue | null;
  id?: string;
}

export function FieldValidationMessage({ issue, id }: FieldValidationMessageProps) {
  if (!issue) return null;

  const isError = issue.severity === "error";

  return (
    <p
      id={id}
      role={isError ? "alert" : "status"}
      className={`mt-1 flex items-start gap-1.5 text-[11px] leading-snug ${
        isError
          ? "text-destructive font-medium"
          : "text-amber-600 dark:text-amber-400"
      }`}
    >
      {isError ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ) : (
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      )}
      <span>{issue.message}</span>
    </p>
  );
}
