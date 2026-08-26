import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { ScrollToTop } from '@/components/scroll-to-top';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      tabMode="top"
      {...baseOptions()}
    >
      <ScrollToTop />
      {children}
    </DocsLayout>
  );
}
