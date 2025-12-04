import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

interface FormProgressProps {
  steps: { label: string; completed: boolean }[];
}

export const FormProgress = ({ steps }: FormProgressProps) => {
  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Form Progress</span>
        <span className="font-medium">{completedCount}/{steps.length} completed</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-xs p-2 rounded-md transition-colors ${
              step.completed
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <CheckCircle2
              className={`h-3 w-3 ${
                step.completed ? "text-primary" : "text-muted-foreground/50"
              }`}
            />
            <span className="truncate">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
