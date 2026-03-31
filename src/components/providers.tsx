'use client'

import { ThemeProvider } from 'next-themes'
import { CustomCursor } from '@/components/ui/custom-cursor'
import { PageProgress } from '@/components/ui/page-progress'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <CustomCursor />
      <PageProgress />
      {children}
    </ThemeProvider>
  )
}
