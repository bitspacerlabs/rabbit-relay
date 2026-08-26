import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight text-[15px]">
      <span className="inline-flex items-center justify-center size-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/rabbit-relay/rabbit-relay-mini.svg"
          alt=""
          className="size-full dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/rabbit-relay/rabbit-relay-mini-dark.svg"
          alt=""
          className="size-full hidden dark:block"
        />
      </span>
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
