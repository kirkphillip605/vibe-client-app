# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build

# ---- Production stage ----
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npm ci --omit=dev
EXPOSE 4000
CMD ["node", "dist/index.js"]
