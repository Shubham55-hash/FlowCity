# ─── Stage 1: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build tools needed for native modules (e.g. @tensorflow/tfjs-node)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy manifests first for layer-cache efficiency
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -S flowcity && adduser -S flowcity -G flowcity

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled artefacts from builder
COPY --from=builder /app/dist ./dist

# Copy DB schema for migration runner
COPY src/db/schema.sql ./db/schema.sql

# Change ownership
RUN chown -R flowcity:flowcity /app
USER flowcity

# Expose application port
EXPOSE 5000

# Health check (used by Docker & ECS)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.js"]
