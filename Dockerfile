FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV HOSTNAME=0.0.0.0
ENV LESSON_DESIGNER_DATA_DIR=/app/data

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Render mounted disks are attached at runtime, so keeping the runner as root
# avoids write-permission failures when the app initializes db/secret files.
EXPOSE 10000

CMD ["sh", "-c", "export HOSTNAME=$(printf '%s' \"$HOSTNAME\" | tr -d '[:space:]'); export PORT=$(printf '%s' \"$PORT\" | tr -d '[:space:]'); node server.js"]
