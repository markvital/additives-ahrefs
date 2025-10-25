# Agent Guidelines

- This repository uses Next.js 14 with the App Router and TypeScript. Prefer server components unless a client component is required.
- UI components rely on MUI. When creating new UI elements, use the existing theme in `lib/theme.ts` and keep the grayscale visual style.
- Data lives in `data/additives.json`. Do not fetch data at runtime—import the JSON directly for static generation.
- Always run `npm run lint` and `npm run build` before completing a task. Address any issues before delivering changes.
- For UI changes, capture relevant screenshots using the provided browser tooling so reviewers can see the impact.
- Store local screenshots in `_tmp/screenshots/`.
