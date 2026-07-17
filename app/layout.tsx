import type { Metadata } from 'next';
import Link from 'next/link';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Hush Vote · Private voting on Midnight',
  description: 'Cast a private ballot and receive a proof that it was counted.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="Hush Vote home">
            <span className="wordmark-mark" aria-hidden="true">H</span>
            <span>Hush Vote</span>
          </Link>
          <Link href="/deploy" className="quiet-link">Create a ballot</Link>
        </header>
        {children}
        <footer className="site-footer">
          <span>Proofs protect voter identity.</span>
          <span>Built on Midnight.</span>
        </footer>
      </body>
    </html>
  );
}
