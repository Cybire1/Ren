# The Kova API: builds only the API and the packages it depends on from the pnpm workspace.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/tempo/package.json packages/tempo/
RUN pnpm install --frozen-lockfile --filter "@kova/api..."
COPY tsconfig*.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter "@kova/api..." build && pnpm --filter "@kova/api" deploy --prod --legacy /out

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
EXPOSE 4000
CMD ["node", "dist/index.js"]
