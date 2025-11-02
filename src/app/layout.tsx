import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Typography } from '@mui/material';
import { Roboto } from 'next/font/google';

import { Providers } from '../components/Providers';
import { SiteHeader } from '../components/SiteHeader';
import { ReportMistakeProvider } from '../components/ReportMistakeContext';
import { ReportMistakeLink } from '../components/ReportMistakeLink';
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
            <div className="layout">
              <SiteHeader additives={additives} />
              <main className="main-content">
                <div className="content-shell">{children}</div>
              </main>
              <footer className="site-footer">
                <div className="content-shell footer-shell">
                  <nav className="footer-nav" aria-label="Footer">
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
                  <Typography component="p" variant="body2">
                    Food Additives © {currentYear}. All rights reserved.{' '}
                    <Link href="/about" className="footer-link">
                      About
                    </Link>
                  </Typography>
                </div>
              </footer>
            </div>
          </Providers>
        </ReportMistakeProvider>
      </body>
    </html>
  );
}
