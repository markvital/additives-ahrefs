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
import { getAdditives } from '../lib/additives';
import logo2x from '../../img/logo/logo_2x.png';
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
            <div className="layout" id="top">
              <header className="site-header">
                <div className="content-shell header-shell">
                  <div className="header-content">
                    <div className="header-brand">
                      <Link href="/" aria-label="Food Additives home" className="header-logo">
                        <Image
                          src={logo2x}
                          alt="Food Additives logo"
                          width={41}
                          height={50}
                          priority
                        />
                      </Link>
                      <Link href="/" className="header-title-link">
                        Food additives
                      </Link>
                    </div>
                    <nav className="header-nav">
                      <HeaderSearch additives={additives} />
                      <Link href="/compare" className="header-link">
                        Compare
                      </Link>
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
                  </nav>
                </div>
              </footer>
            </div>
          </Providers>
        </ReportMistakeProvider>
      </body>
    </html>
  );
}
