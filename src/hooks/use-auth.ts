import { useSyncExternalStore } from "react";
import { getAuthSnapshot, subscribeToAuth } from "@/api/auth";

export function useAuth() {
  return useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getAuthSnapshot);
}
