# Nibbles

An explainable, circle-aware book recommender wrapped in a warm reading tracker.

See [CLAUDE.md](./CLAUDE.md) for the project's rules, tech stack, and build order — every change in this repo should follow it.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm run dev
```

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start the dev server                |
| `npm run build`        | Type-check and build for production |
| `npm run test`         | Run the test suite once             |
| `npm run test:watch`   | Run tests in watch mode             |
| `npm run lint`         | Lint with ESLint                    |
| `npm run format`       | Format with Prettier                |
| `npm run format:check` | Check formatting without writing    |
| `npm run typecheck`    | Type-check without emitting         |

## Contributing

All changes go through a pull request — nothing is committed directly to `main`, and nothing deploys automatically. See `CLAUDE.md` for the full workflow.

<!-- CI smoke test: confirms the CI workflow runs on a PR after Phase 1 merged. -->
