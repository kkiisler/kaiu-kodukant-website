# Multi-stage build for static website
FROM alpine:3.18 AS builder

# Install required tools for config substitution
RUN apk add --no-cache gettext

# Copy website files
WORKDIR /app
COPY . .

# Create entrypoint script for runtime config injection
RUN cat > /app/docker-entrypoint.sh << 'EOF'
#!/bin/sh
set -e

# Replace config placeholders with environment variables
if [ ! -z "$GOOGLE_APPS_SCRIPT_URL" ]; then
    find /usr/share/caddy -name "*.html" -exec sed -i "s|YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE|$GOOGLE_APPS_SCRIPT_URL|g" {} \;
    find /usr/share/caddy -name "*.js" -exec sed -i "s|YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE|$GOOGLE_APPS_SCRIPT_URL|g" {} \;
fi

if [ ! -z "$RECAPTCHA_SITE_KEY" ]; then
    find /usr/share/caddy -name "*.html" -exec sed -i "s|YOUR_RECAPTCHA_SITE_KEY_HERE|$RECAPTCHA_SITE_KEY|g" {} \;
    find /usr/share/caddy -name "*.js" -exec sed -i "s|YOUR_RECAPTCHA_SITE_KEY_HERE|$RECAPTCHA_SITE_KEY|g" {} \;
fi

# Execute the main command
exec "$@"
EOF

RUN chmod +x /app/docker-entrypoint.sh

# Production image with Caddy
FROM caddy:2.7-alpine

# No need for bash, use sh which is already in alpine

# Copy static files
COPY --from=builder /app/*.html /usr/share/caddy/
COPY --from=builder /app/css /usr/share/caddy/css
COPY --from=builder /app/js /usr/share/caddy/js
COPY --from=builder /app/media /usr/share/caddy/media
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh

# Set working directory
WORKDIR /usr/share/caddy

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Expose ports
EXPOSE 80 443

# Use custom entrypoint for config injection
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["caddy", "file-server", "--listen", ":80"]