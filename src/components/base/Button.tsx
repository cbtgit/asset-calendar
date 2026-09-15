import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "default" | "compact";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  className,
  ref,
  size = "default",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn("button", `button-${size}`, `button-${variant}`, className)}
      type={type}
      {...props}
    />
  );
}
