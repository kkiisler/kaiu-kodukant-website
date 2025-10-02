FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies (for better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY api/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Copy application code
COPY api/ ./

# Create data directory for SQLite
RUN mkdir -p /data && chown -R node:node /data

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "server.js"]