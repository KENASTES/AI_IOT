FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund

COPY . .

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8501').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Runs the existing Vinext/Next application. The final flags override the
# repository's development defaults so Cloudflare Tunnel can reach port 8501.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8501"]
