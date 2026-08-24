import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight text-[15px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rabbit-relay.svg"
        alt=""
        className="size-6 rounded-md"
        width={24}
        height={24}
      />
      {appName}
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      { text: 'Docs', url: '/docs' },
      {
        text: 'GitHub',
        url: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
      },
    ],
  };
}
