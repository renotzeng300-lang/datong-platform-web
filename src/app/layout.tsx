import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '大同發展中心｜營運暨評鑑追蹤', template: '%s｜大同發展中心' },
  description: '臺北市大同發展中心 營運管理暨評鑑品質追蹤平台',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f6e6a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
