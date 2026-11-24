import { Progress } from "@/components/ui/progress";

interface FormProgressProps {
  steps: { label: string; completed: boolean }[];
}

export const FormProgress = ({ steps }: FormProgressProps) => {
  const completedCount = steps.filter((s) => s.completed).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">Completion progress</span>
        <span className="font-medium text-foreground">
          {completedCount} of {steps.length} fields ready
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
};
