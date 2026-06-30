import { QueryClient } from '@tanstack/react-query'

// ─── TanStack Query Client ─────────────────────────────────────────────────
// Configured for BIM platform data characteristics:
//  - staleTime: 60s — project/document lists don't change every second
//  - gcTime: 5min — keep cached BIM data in memory for smooth navigation
//  - retry: 2 — retry failed requests twice before showing error
//  - refetchOnWindowFocus: false — BIM tools don't need background sync

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,         // 1 minute
      gcTime: 5 * 60 * 1000,        // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})
