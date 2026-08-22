FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=frontend-build /app/dist /app/frontend-dist
ENV NODE_ENV=production
ENV STATIC_FRONTEND_DIR=/app/frontend-dist
EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5002/health || exit 1
CMD ["node", "index.js"]
