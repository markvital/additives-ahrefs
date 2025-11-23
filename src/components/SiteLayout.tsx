import { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { LastUpdated } from './LastUpdated';

interface SiteLayoutProps {
  children: ReactNode;
}

/**
 * Main site layout with header and footer.
 * Used for all regular pages (not preview pages).
 */
export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="layout" id="top">
      <SiteHeader />
      <main className="main-content">
        <div className="content-shell">{children}</div>
      </main>
      <LastUpdated />
      <SiteFooter />
    </div>
  );
}
