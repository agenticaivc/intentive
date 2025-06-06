<!-- CONTRIBUTING.md -->
# Contributing to Intentive 🚀

Thanks for taking the time to contribute!

## Quick start

```bash
git clone https://github.com/agenticaivc/intentive.git
cd intentive
pnpm install
pnpm run dev             # spins up Fastify gateway on :4000
```

## Project layout

```
packages/
  gateway/         HTTP front end
  executor/        Graph runtime
  nlp/             Intent parser
docs/              Specs & diagrams
```

## Coding standards

* **TypeScript strict-mode**; no `any`.  
* Prettier, ESlint (`npm run lint`) must pass.  
* 80 % line coverage enforced in CI (`npm test`).  

## Branch & PR workflow

1. Fork → feature branch `username/feat-xyz`.  
2. `pnpm test` + `pnpm run lint`.  
3. Open PR against **main**; fill template; squash-merge only.  

## Commit style

Conventional Commits, e.g.:

```
feat(parser): support multiple alternatives
fix(executor): handle zero-edge graphs
```

## Issue triage

Label new issues with `bug`, `enhancement`, or `discussion`.  
Need help? Comment @maintainers.

Happy hacking!
