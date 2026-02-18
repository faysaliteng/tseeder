FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json .
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json .

# Runtime environment (set via Kubernetes secrets / env injection)
ENV PORT=8787
ENV DOWNLOAD_DIR=/tmp/rdm
ENV MAX_CONCURRENT_JOBS=10
# WORKER_ID, WORKER_CLUSTER_TOKEN, CALLBACK_SIGNING_SECRET,
# R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
# must be injected at runtime via Kubernetes secrets or Docker env

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f -H "Authorization: Bearer $WORKER_CLUSTER_TOKEN" http://localhost:8787/health || exit 1

CMD ["bun", "run", "src/index.ts"]
