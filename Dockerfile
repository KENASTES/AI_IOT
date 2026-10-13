FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund

COPY . .

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5173').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Runs the existing Vinext/Next application on the port used by the Pi's
# Cloudflare Tunnel setup. Keep the tunnel's localhost:5173 target in sync.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
