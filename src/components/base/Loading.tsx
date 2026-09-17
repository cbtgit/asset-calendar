import { cn } from "@/lib/utils";
import "./Loading.css";

type LoadingProps = {
  className?: string;
};

export function Loading({ className }: LoadingProps) {
  return (
    <div className={cn("loading", className)} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span className="loading-label">Loading...</span>
    </div>
  );
}
