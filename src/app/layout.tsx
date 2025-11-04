import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Typography } from '@mui/material';
import { Roboto } from 'next/font/google';

import { Providers } from '../components/Providers';
import { SiteHeader } from '../components/SiteHeader';
import { ReportMistakeProvider } from '../components/ReportMistakeContext';
import { ReportMistakeLink } from '../components/ReportMistakeLink';
import { CompareFlapProvider } from '../components/CompareFlap';
import { getAdditives } from '../lib/additives';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Food Additives Catalogue',
  description:
    'Browse essential information about food additives, including synonyms, functions, and links to additional resources.',
};

const currentYear = new Date().getFullYear();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const additives = getAdditives();

  return (
    <html lang="en">
      <body className={roboto.className}>
        <ReportMistakeProvider>
          <Providers>
            <CompareFlapProvider additives={additives}>
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
                          Food additives
                        </Link>
                        <span aria-hidden="true">© {currentYear}</span>
                      </Typography>
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
                      <Suspense fallback={null}>
                        <ReportMistakeLink className="header-link" />
                      </Suspense>
                    </nav>
                  </div>
                </footer>
              </div>
            </CompareFlapProvider>
          </Providers>
        </ReportMistakeProvider>
      </body>
    </html>
  );
}
