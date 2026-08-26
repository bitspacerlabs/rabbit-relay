import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

const code = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-code',
});

export const metadata: Metadata = {
  icons: {
    icon: '/rabbit-relay/favicon.svg',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.className} ${code.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
