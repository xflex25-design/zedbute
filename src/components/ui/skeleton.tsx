import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-none bg-muted/75", className)}
      {...props}
    />
  );
}

export { Skeleton };
