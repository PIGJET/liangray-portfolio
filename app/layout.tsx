import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://liangray-li-portfolio.milky-robin-4084.chatgpt.site'),
  title: 'Liangray Li — Creative Developer',
  description: 'Selected work and experiments by Liangray Li, a creative developer in Toronto.',
  openGraph: {
    title: 'Liangray Li — Creative Developer',
    description: 'Selected work and experiments by Liangray Li, a creative developer in Toronto.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liangray Li — Creative Developer',
    description: 'Selected work and experiments by Liangray Li, a creative developer in Toronto.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
