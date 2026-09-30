# Liangray Li — Portfolio

> An immersive creative-developer portfolio built around typography, motion, and a responsive particle identity.

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)

![Liangray Li portfolio hero](docs/demo.png)

## Overview

This portfolio explores the space between interaction design and creative development. Its opening identity is rendered as an animated Three.js particle field, followed by an editorial project index and restrained personal sections designed to keep the work at the center.

## Highlights

- GPU-rendered particle typography with a deliberate enter transition.
- Responsive editorial layout with oversized type and strong visual rhythm.
- Accessible landmarks, navigation labels, and interaction controls.
- Open Graph artwork and a custom favicon for polished sharing.
- React Server Components tooling through Vinext and Vite.
- Cloudflare Workers-compatible production output.

## Tech stack

React 19 · TypeScript · Three.js · Tailwind CSS · Vinext · Vite · Cloudflare Workers

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The development server prints the local URL when it starts.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server with Vinext and Vite. |
| `npm run build` | Create a production build. |
| `npm run start` | Preview an existing production build locally with Wrangler. |
| `npm run lint` | Check the codebase with Oxlint. |
| `npm run format` | Format supported files with Oxfmt. |

## Project structure

- `app/page.tsx` contains the portfolio content and page sections.
- `app/globals.css` defines the visual system, layout, and motion.
- `components/particles/ParticleScene.tsx` renders the interactive hero experience.
- `lib/particleTextGenerator.ts` converts the hero wordmark into particle targets.
- `public/` contains the favicon and social preview image.
- `vite.config.ts` configures the production build.

## Deployment

Production builds target Cloudflare Workers. Run `npm run build` before deployment to catch type, bundling, and runtime configuration errors locally.
