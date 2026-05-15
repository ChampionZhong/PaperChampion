# ============================================================
# PaperChampion Frontend Dockerfile - Nginx static hosting.
# ============================================================

FROM node:20-slim AS builder

WORKDIR /build

COPY package*.json ./

# Use a regional npm mirror when available.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund --registry=https://registry.npmmirror.com; else npm install --no-audit --no-fund --registry=https://registry.npmmirror.com; fi

COPY . ./

RUN npm run build

# ============================================================
# Stage 2: Nginx static hosting.
# ============================================================
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD wget -q -O /dev/null http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
