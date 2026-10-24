FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.25.0

WORKDIR /app

# 先复制 workspace 清单，让依赖安装层可以独立缓存。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/studio/package.json apps/studio/package.json
COPY apps/runtime/package.json apps/runtime/package.json
COPY packages/materials/package.json packages/materials/package.json
COPY packages/materials-react/package.json packages/materials-react/package.json
COPY packages/page-runtime/package.json packages/page-runtime/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# vendor 未提交到仓库，镜像构建时拉取；随后构建 Lit 物料、studio 和 runtime。
RUN pnpm vendor \
  && pnpm build \
  && pnpm --filter @lc/server deploy --prod --legacy /app/server-deploy


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_FILE=/data/lowcode.db \
    STUDIO_DIR=/app/studio \
    RUNTIME_DIR=/app/runtime

WORKDIR /app/server

COPY --from=build --chown=node:node /app/server-deploy ./
COPY --from=build --chown=node:node /app/apps/studio/dist /app/studio
COPY --from=build --chown=node:node /app/apps/runtime/dist /app/runtime

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "node_modules/.bin/tsx", "src/index.ts"]
