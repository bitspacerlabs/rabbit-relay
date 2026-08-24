import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-6 place-items-center rounded-md bg-fd-primary text-fd-primary-foreground text-sm">
            🐇
          </span>
          {appName}
        </span>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      { text: 'Docs', url: '/docs' },
      { text: 'GitHub', url: `https://github.com/${gitConfig.user}/${gitConfig.repo}` },
    ],
  };
}
