import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import DefaultSearchDialog from '@/components/search';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

const code = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-code',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bitspacerlabs.github.io/rabbit-relay'),
  title: {
    default: 'Rabbit Relay',
    template: '%s | Rabbit Relay',
  },
  description:
    'Type-safe RabbitMQ framework for Node.js with typed events, publisher confirms, retries, DLQs, RPC, reconnect, and OpenTelemetry.',
  icons: {
    icon: '/rabbit-relay/favicon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Rabbit Relay',
    locale: 'en_US',
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
        <RootProvider
          search={{
            SearchDialog: DefaultSearchDialog,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
