# Rabbit Relay docs (Fumadocs trial)

Next.js 16 + Fumadocs. Docs-intro is the site root (`/` redirects to `/docs`).

```bash
npm install
npm run dev     # http://localhost:3000/docs
npm run build   # static-ish production build
```

## Optional: Ask AI assistant

The floating "Ask AI" button uses OpenRouter with docs-grounded search.
Without a key everything else works; only that button errors when used.

```bash
cp .env.local.example .env.local   # then add your key
```

## Content

Pages live in `content/docs/*.mdx`. Sidebar order: `content/docs/meta.json`.
Components available in MDX: `Tabs/Tab`, `Steps/Step`, `Cards/Card`,
`Callout`, `TypeTable` (registered in `src/components/mdx.tsx`).
