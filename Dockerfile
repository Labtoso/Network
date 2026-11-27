# ============================================================================
# LABTOSO NETWORK CONTROL SUITE - MULTI-STAGE PRODUCTION DOCKERFILE
# ============================================================================
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl git

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate && npx prisma db push --skip-generate && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:./dev.db"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data /app/certs && \
    openssl req -x509 -new -nodes -newkey rsa:2048 \
      -keyout /app/certs/labtoso-root-ca.key \
      -sha256 -days 3650 \
      -out /app/certs/labtoso-root-ca.crt \
      -subj "/C=DE/ST=Home/L=LAN/O=Labtoso Zero-Trust Network/CN=Labtoso Root CA" && \
    chown -R nextjs:nodejs /app/data /app/certs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
