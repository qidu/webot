# Base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (skip devDependencies for production)
RUN npm ci --only=production --no-optional

# Copy source and built files
COPY src/ ./src/
COPY dist/ ./dist/
COPY index.html ./

# Environment variables
ENV PORT=3010
ENV GATEWAY_URL=ws://127.0.0.1:18789
ENV GATEWAY_TOKEN=b414cc61bec43bbc771a771ef0007933161f1cfd29a3ab83

# Expose port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/api/config', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start server
CMD ["node", "dist/server.js"]
