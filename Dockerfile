# TeamFlow backend on Railway — bun runtime (matches local dev `bun src/index.ts` + CI).
# Build context is the repo root; the monorepo lives in ./taskChecker.
FROM oven/bun:1 AS runtime
ENV NODE_ENV=production
WORKDIR /app/taskChecker
COPY taskChecker/package.json taskChecker/bun.lock ./
COPY taskChecker/apps/backend/package.json ./apps/backend/package.json
COPY taskChecker/apps/frontend/package.json ./apps/frontend/package.json
COPY taskChecker/apps/docs/package.json ./apps/docs/package.json
COPY taskChecker/packages/ui/package.json ./packages/ui/package.json
COPY taskChecker/packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY taskChecker/packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN bun install
COPY taskChecker/ ./
WORKDIR /app/taskChecker/apps/backend
EXPOSE 4002
CMD ["sh", "-c", "bun run db:migrate && bun src/index.ts"]
