import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Typography } from '@mui/material';
import { Roboto } from 'next/font/google';

import { Providers } from '../components/Providers';
import { HeaderSearch } from '../components/HeaderSearch';
import { getAdditives } from '../lib/additives';
import logo2x from '../img/logo/logo_2x.png';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Skin Care Ingredients Library',
  description:
    'Browse expert snapshots of skin care ingredients, including their benefits, origins, and tips for pairing them in a routine.',
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
        <Providers>
          <div className="layout">
            <header className="site-header">
              <div className="content-shell header-shell">
                <div className="header-content">
                  <Link href="/" aria-label="Skin Care Ingredients home" className="header-logo">
                    <Image
                      src={logo2x}
                      alt="Skin Care Ingredients logo"
                      width={41}
                      height={50}
                      priority
                    />
                  </Link>
                  <nav className="header-nav">
                    <HeaderSearch additives={additives} />
                    <Link href="/compare" className="header-link">
                      Compare
                    </Link>
                  </nav>
                </div>
              </div>
            </header>
            <main className="main-content">
              <div className="content-shell">{children}</div>
            </main>
            <footer className="site-footer">
              <div className="content-shell">
                <Typography component="p" variant="body2">
                  Skin Care Ingredients © {currentYear}. All rights reserved.
                </Typography>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
