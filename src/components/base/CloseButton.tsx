import type { ButtonProps } from "./Button";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import "./CloseButton.css";

type CloseButtonProps = Omit<ButtonProps, "aria-label" | "children" | "title"> & {
  label: string;
};

export function CloseButton({ className, label, ...props }: CloseButtonProps) {
  return (
    <Button {...props} className={cn("close-button", className)} aria-label={label} title={label}>
      <span className="close-button-icon" aria-hidden="true" />
    </Button>
  );
}
