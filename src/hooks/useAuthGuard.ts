/**
 * Auth guard hook — redirects to /auth/login if user is not authenticated.
 * Returns { isLoading, isAuthenticated, user } so pages can show a loader.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authMe } from "@/lib/api";

export function useAuthGuard() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-restore"],
    queryFn: () => authMe.me(),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isLoading && (isError || !data?.user)) {
      navigate("/auth/login", { replace: true });
    }
  }, [isLoading, isError, data, navigate]);

  return {
    isLoading,
    isAuthenticated: !!data?.user,
    user: data?.user ?? null,
  };
}
