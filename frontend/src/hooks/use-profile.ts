import useSWR from "swr";
import type { Profile, ProfileMetrics } from "@/lib/types";

export function useProfile() {
  return useSWR<Profile>("/api/profile");
}

export function useProfileMetrics() {
  return useSWR<ProfileMetrics>("/api/profile/metrics");
}
