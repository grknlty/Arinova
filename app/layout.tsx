import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Arinova · Kleine stappen, grote ontdekkingen',
  description:
    'Een fijne plek om te leren, oefenen en groeien. Nederlands, Türkçe, English.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
