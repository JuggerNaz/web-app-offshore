'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { SWRConfig } from 'swr'
import { useState, useEffect } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  // Prevent mouse wheel from unintentionally changing number input values when scrolling panels or the window
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === 'number'
      ) {
        document.activeElement.blur();
      }
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type === 'number'
      ) {
        e.target.blur();
      }
    };

    window.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {/* Egress guard: SWR defaults revalidated EVERY mounted key on every
          tab focus (with a 2s dedup), repeatedly re-downloading heavy lists
          (1000-row jobpack payloads, platform lists, auth/profile). Focus
          revalidation is now off — mounts still fetch when stale, and
          explicit mutate() calls after writes keep data fresh. */}
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          dedupingInterval: 30_000,
        }}
      >
        {children}
      </SWRConfig>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
