import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const isExport = process.env.EXPORT === '1';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  ...(isExport && {
    output: 'export',
    basePath: '/rabbit-relay',
    images: {
      unoptimized: true,
    },
  }),
};

export default withMDX(config);
