FROM oven/bun:1.4.2 AS dependencies
WORKDIR /app/api
COPY api/package.json api/bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.2 AS api-runtime
WORKDIR /app/api
COPY --from=dependencies /app/api/node_modules ./node_modules
COPY api/src ./src
COPY api/client ./client
COPY api/scripts ./scripts
COPY api/migrations ./migrations
COPY api/package.json ./
COPY client/src /app/client/src
# Shared pure client geometry resolves the same installed Three dependency.
RUN ln -s /app/api/node_modules /app/node_modules
USER bun
ENV HOST=0.0.0.0
EXPOSE 4000
CMD ["bun", "src/index.ts"]
