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

const siteUrl = process.env.SITE_URL;
const socialImage =
  'https://raw.githubusercontent.com/PIGJET/liangray-portfolio/main/public/og.png';

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: 'Liangray Li — Creative Developer',
  description: 'Selected work and experiments by Liangray Li, a creative developer in Toronto.',
  openGraph: {
    title: 'Liangray Li — Creative Developer',
    description: 'Selected work and experiments by Liangray Li, a creative developer in Toronto.',
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liangray Li — Creative Developer',
    description: 'Selected work and experiments by Liangray Li, a creative developer in Toronto.',
    images: [socialImage],
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
