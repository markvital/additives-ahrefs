'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { Typography } from '@mui/material';
import { SiteHeader } from './SiteHeader';
import { ReportMistakeLink } from './ReportMistakeLink';
import ahrefsLogo from '../../img/branded/ahrefs-logo.svg';

const currentYear = new Date().getFullYear();

interface ConditionalLayoutProps {
  children: ReactNode;
}

/**
 * Conditionally renders header/footer based on the current route.
 * Preview routes (/preview/*) are rendered without any layout chrome.
 */
export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isPreview = pathname?.startsWith('/preview');

  if (isPreview) {
    // Preview pages: render only children without header/footer
    return <>{children}</>;
  }

  // Regular pages: render with full layout
  return (
    <div className="layout" id="top">
      <SiteHeader />
      <main className="main-content">
        <div className="content-shell">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="content-shell footer-shell">
          <nav className="footer-nav" aria-label="Footer">
            <Typography component="span" variant="body2" className="footer-brand">
              <Link href="#top" className="footer-brand-link">
                Food Additives
              </Link>
              <span aria-hidden="true">© {currentYear}</span>
            </Typography>
            <div className="footer-links">
              <Link href="/about" className="header-link">
                About
              </Link>
              <Link href="/compare" className="header-link">
                Compare
              </Link>
              <Link href="/function" className="header-link">
                Functions
              </Link>
              <Link href="/origin" className="header-link">
                Origins
              </Link>
              <Link href="/privacy" className="header-link">
                Privacy
              </Link>
              <Link href="/terms" className="header-link">
                Terms
              </Link>
              <Suspense fallback={null}>
                <ReportMistakeLink className="header-link" />
              </Suspense>
            </div>
            <Link
              href="https://ahrefs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-data-link"
            >
              <span>data by</span>
              <Image
                src={ahrefsLogo}
                alt="Ahrefs"
                height={16}
                style={{ width: 'auto', height: '16px' }}
              />
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
