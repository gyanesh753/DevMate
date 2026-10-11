# DevMate web client

Run setup and installation from the repository root; see [the main README](../README.md).

- Development: `npm run dev:web` from the root.
- Build: `npm run build` from the root; output is `client/dist`.
- Configuration: copy `.env.example` to `.env.local` or use `npm run setup:local`.
- Production: configure Vite variables before building and route non-asset URLs to `index.html`.

Authentication, return-to navigation, project discovery, profile editing, application tracking, and owner management use the Express API contracts in [docs/api.md](../docs/api.md).
