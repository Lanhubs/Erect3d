FROM oven/bun:1.4.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY api/package.json api/
COPY client/package.json client/
COPY motion-video/package.json motion-video/
RUN bun install --frozen-lockfile --filter @erect3d/api

FROM oven/bun:1.4.4 AS api-runtime
# qpdf optimises PDFs; DejaVu gives the CAD rasteriser real glyphs so room labels survive conversion.
# libredwg-tools (GPLv3) is opt-in: it only adds DWG import/export, DXF works without it.
ARG WITH_LIBREDWG=0
RUN apt-get update && apt-get install -y --no-install-recommends qpdf fonts-dejavu-core && \
  if [ "$WITH_LIBREDWG" = "1" ]; then apt-get install -y --no-install-recommends libredwg-tools; fi && \
  rm -rf /var/lib/apt/lists/*
WORKDIR /app/api
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/api/node_modules ./node_modules
COPY api/src ./src
COPY api/client ./client
COPY api/scripts ./scripts
COPY api/migrations ./migrations
COPY api/package.json ./
COPY client/src /app/client/src
# Shared pure client geometry resolves the same installed Three dependency.
RUN ln -s /app/api/node_modules /app/client/node_modules
USER bun
ENV HOST=0.0.0.0
ENV PDF_OPTIMIZER_PATH=/usr/bin/qpdf
# Probed at startup; absent binaries simply disable the DWG capabilities.
ENV DWG_CONVERTER_PATH=/usr/bin/dwg2dxf
ENV DXF_TO_DWG_CONVERTER_PATH=/usr/bin/dxf2dwg
EXPOSE 4000
CMD ["bun", "src/index.ts"]
