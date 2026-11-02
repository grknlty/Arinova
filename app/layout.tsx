import type { Metadata, Viewport } from 'next';
import { DM_Sans, Nunito } from 'next/font/google';
import './globals.css';

// Self-hosted at build time; latin-ext covers Turkish letters such as ş, ğ, ı.
const body = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
});
const heading = Nunito({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800', '900'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Arinova · Kleine stappen, grote ontdekkingen',
  description:
    'Een fijne plek om te leren, oefenen en groeien. Nederlands, Türkçe, English.',
};
export const viewport: Viewport = {
  themeColor: '#faf9f5',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${body.variable} ${heading.variable}`}>
      <body>{children}</body>
    </html>
  );
}
