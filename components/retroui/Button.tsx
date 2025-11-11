import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import React, { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";

const buttonVariants = cva(
  "font-head transition-all rounded outline-hidden cursor-pointer duration-200 font-medium flex items-center",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-2 border-black transition hover:translate-y-1 active:translate-y-2 active:translate-x-1 hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground border-2 border-black transition hover:translate-y-1 active:translate-y-2 active:translate-x-1 hover:bg-secondary-hover",
        outline:
          "bg-transparent border-2 border-black transition hover:translate-y-1 active:translate-y-2 active:translate-x-1",
        link: "bg-transparent hover:underline",
      },
      size: {
        sm: "px-3 py-1 text-sm",
        md: "px-4 py-1.5 text-base",
        lg: "px-6 lg:px-8 py-2 lg:py-3 text-md lg:text-lg",
        icon: "p-2",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export interface IButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, IButtonProps>(
  (
    {
      children,
      size = "md",
      className = "",
      variant = "default",
      asChild = false,
      style,
      ...props
    }: IButtonProps,
    forwardedRef
  ) => {
    const Comp = asChild ? Slot : "button";
    const hasHoverEffect = variant !== "link";
    const shadowStyle = hasHoverEffect ? {
      boxShadow: "3px 3px 0px 0px rgba(0, 0, 0, 1)",
      ...style
    } : style;

    return (
      <Comp
        ref={forwardedRef}
        className={cn(buttonVariants({ variant, size }), className)}
        style={shadowStyle}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";
