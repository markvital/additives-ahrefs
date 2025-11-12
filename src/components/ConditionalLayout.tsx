'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { SiteLayout } from './SiteLayout';

interface ConditionalLayoutProps {
  children: ReactNode;
}

/**
 * Routes to appropriate layout based on pathname.
 * - Preview pages (/_preview/*): render without layout chrome
 * - Regular pages: render with SiteLayout (header/footer)
 */
export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isPreview = pathname?.startsWith('/_preview');

  if (isPreview) {
    return <>{children}</>;
  }

  return <SiteLayout>{children}</SiteLayout>;
}
