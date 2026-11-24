import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium ring-offset-background transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-glow",
        destructive: "bg-destructive text-destructive-foreground border border-border hover:bg-destructive/90 hover:-translate-y-0.5",
        outline: "border border-border bg-transparent text-foreground hover:bg-foreground hover:text-background hover:border-foreground hover:-translate-y-0.5",
        secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-foreground hover:text-background hover:-translate-y-0.5",
        ghost: "text-foreground hover:bg-muted hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        hero: "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-glow font-semibold",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-none px-4 text-xs",
        lg: "h-12 rounded-none px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
