/**
 * Restores the CSRF token on page load by calling /auth/me.
 * Use this hook in every authenticated page/layout.
 */
import { useQuery } from "@tanstack/react-query";
import { authMe } from "@/lib/api";

export function useSessionRestore() {
  return useQuery({
    queryKey: ["session-restore"],
    queryFn: () => authMe.me(),   // authMe.me() already calls setCsrfToken()
    retry: false,
    staleTime: 5 * 60_000,       // re-check every 5 min
    refetchOnWindowFocus: false,
  });
}
