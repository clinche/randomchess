import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

// Import our custom I18nProvider
import { I18nProvider } from '@/lib/i18n/i18n-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RandomChess',
  description: 'A chess variant with random starting positions',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const basePath = process.env.NODE_ENV === 'production' ? '/randomchess' : '';
  
  return (
    <html lang="en">
      <head>
        {/* Service worker to enable SharedArrayBuffer on GitHub Pages */}
        <Script 
          src={`${basePath}/coi-serviceworker.js`} 
          strategy="beforeInteractive" 
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
