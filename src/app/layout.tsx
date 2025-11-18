import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import Script from 'next/script';

import { Providers } from '../components/Providers';
import { ReportMistakeProvider } from '../components/ReportMistakeContext';
import { CompareFlapProvider } from '../components/CompareFlap';
import { ConditionalLayout } from '../components/ConditionalLayout';
import { getAdditives } from '../lib/additives';
import { siteUrl } from '../lib/site';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Food Additive Catalogue',
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
      <head>
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="Fj7+bX0Bk8e745CrMY+rpQ"
          strategy="afterInteractive"
        />
      </head>
      <body className={roboto.className}>
        <ReportMistakeProvider>
          <Providers>
            <CompareFlapProvider additives={additives}>
              <ConditionalLayout>{children}</ConditionalLayout>
            </CompareFlapProvider>
          </Providers>
        </ReportMistakeProvider>
      </body>
    </html>
  );
}
