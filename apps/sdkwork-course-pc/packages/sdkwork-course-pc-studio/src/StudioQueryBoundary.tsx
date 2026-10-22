import React, { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Keeps the creator studio on the same React Query module instance as its
 * pages. The host shell and the course packages can resolve different
 * patch-level copies of the library; sharing the shell provider across both
 * leaves the studio reading a different context and crashing with
 * "No QueryClient set".
 */
export function StudioQueryBoundary({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
