This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Variables d'environnement

Le frontend ne contient **aucune adresse de serveur par défaut**. Il faut poser
l'adresse du backend, sinon `next build` et `next dev` s'arrêtent avec un
message qui nomme les variables attendues.

| Variable | Rôle |
|---|---|
| `BACKEND_URL` | **Obligatoire.** Adresse du backend, lue par `next.config.mjs` (CSP, relais `/uploads`) et par les route handlers `app/api/**` (`lib/env.ts`). HTTPS exigé, sauf `localhost` / `127.0.0.1` en développement. |
| `NEXT_PUBLIC_BACKEND_URL` | Facultative. Si elle est posée, `next.config.mjs` la préfère à `BACKEND_URL`. Les route handlers, eux, ne lisent que `BACKEND_URL`. |

En local, dans un fichier `.env.local` (jamais commité) :

```
BACKEND_URL=http://localhost:4000
```

Sur Vercel, la variable se pose dans *Settings → Environment Variables*, pour
chaque environnement qui construit le projet (Production, Preview, Development).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
