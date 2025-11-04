import { Suspense } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Typography } from '@mui/material';
import { Roboto } from 'next/font/google';

import { Providers } from '../components/Providers';
import { HeaderSearch } from '../components/HeaderSearch';
import { ReportMistakeProvider } from '../components/ReportMistakeContext';
import { ReportMistakeLink } from '../components/ReportMistakeLink';
import { CompareFlapProvider } from '../components/CompareFlap';
import { getAdditives } from '../lib/additives';
import './globals.css';
import ahrefsLogo from '../../img/branded/ahrefs-logo.svg';

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
                <header className="site-header">
                  <div className="content-shell header-shell">
                    <div className="header-content">
                      <div className="header-brand">
                        <Link href="/" aria-label="Food Additives home" className="header-logo">
                          <span className="header-logo-mobile">
                            <Image
                              src="/img/logo_square.svg"
                              alt=""
                              width={82}
                              height={99}
                              priority
                              sizes="(max-width: 900px) 48px, 0px"
                            />
                          </span>
                          <span className="header-logo-desktop">
                            <Image
                              src="/img/logo_wide.svg"
                              alt=""
                              width={647}
                              height={99}
                              priority
                              sizes="(max-width: 900px) 0px, 340px"
                            />
                          </span>
                        </Link>
                      </div>
                      <nav className="header-nav">
                        <HeaderSearch additives={additives} />
                        <Link href="/about" className="header-link header-about-link">
                          <span className="header-about-icon" aria-hidden="true">
                            <InfoOutlinedIcon fontSize="small" />
                          </span>
                          <span className="header-about-text">About</span>
                        </Link>
                      </nav>
                    </div>
                  </div>
                </header>

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
            </CompareFlapProvider>
          </Providers>
        </ReportMistakeProvider>
      </body>
    </html>
  );
}
