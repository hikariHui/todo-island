# syntax=docker/dockerfile:1

# Node 版本一次声明，base/runner 两处引用，避免漂移
ARG NODE_VERSION=22.23.3

FROM node:${NODE_VERSION}-bookworm-slim AS base
# pnpm 原生二进制与 corepack 下载统一走镜像源：构建环境常无法直连 registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# 预热：pnpm >=11 的包只是 JS 包装器，原生二进制（@pnpm/exe.*）在首次运行时才下载，
# 且只落在当前 stage 的文件系统里。这里提前跑一次把二进制烧进 base 层，
# deps/builder 均从 base 继承，后续任何 pnpm 调用都不再访问网络。
RUN corepack enable \
  && corepack prepare pnpm@12.7.0 --activate \
  && pnpm --version
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/app/data

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.js"]
