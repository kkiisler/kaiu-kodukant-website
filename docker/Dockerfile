# Multi-stage build for MTÜ Kaiu Kodukant Website
# Build stage with variable substitution
FROM alpine:3.18 AS builder

# Build arguments for configuration
ARG GOOGLE_APPS_SCRIPT_URL
ARG RECAPTCHA_SITE_KEY

# Copy all website files
WORKDIR /app
COPY . .

# Replace placeholders at build time
# This ensures variables are baked into the files
RUN if [ -n "$GOOGLE_APPS_SCRIPT_URL" ]; then \
        sed -i "s|YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE|${GOOGLE_APPS_SCRIPT_URL}|g" js/config.js; \
    fi && \
    if [ -n "$RECAPTCHA_SITE_KEY" ]; then \
        sed -i "s|YOUR_RECAPTCHA_SITE_KEY_HERE|${RECAPTCHA_SITE_KEY}|g" js/config.js; \
    fi

# Verify substitution (for debugging)
RUN echo "Config.js after substitution:" && head -20 js/config.js

# Production stage with Caddy
FROM caddy:2.7-alpine

# Copy processed static files from builder
COPY --from=builder /app/*.html /usr/share/caddy/
COPY --from=builder /app/css /usr/share/caddy/css
COPY --from=builder /app/js /usr/share/caddy/js
COPY --from=builder /app/media /usr/share/caddy/media 2>/dev/null || true

# Set working directory
WORKDIR /usr/share/caddy

# Expose ports
EXPOSE 80 443

# Default command - Caddy will use the mounted Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]