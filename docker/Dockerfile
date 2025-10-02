# Multi-stage build for MTÜ Kaiu Kodukant Website
# Build stage with variable substitution
FROM alpine:3.18 AS builder

# Build arguments for configuration
ARG GOOGLE_APPS_SCRIPT_URL
ARG RECAPTCHA_SITE_KEY

# Copy all website files
WORKDIR /app
COPY . .

# Debug: Show build args
RUN echo "Build args received:" && \
    echo "GOOGLE_APPS_SCRIPT_URL=${GOOGLE_APPS_SCRIPT_URL}" && \
    echo "RECAPTCHA_SITE_KEY=${RECAPTCHA_SITE_KEY}"

# Replace placeholders at build time
# This ensures variables are baked into the files
RUN if [ -n "$GOOGLE_APPS_SCRIPT_URL" ] && [ "$GOOGLE_APPS_SCRIPT_URL" != "" ]; then \
        echo "Replacing GOOGLE_APPS_SCRIPT_URL..." && \
        sed -i "s|YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE|${GOOGLE_APPS_SCRIPT_URL}|g" /app/js/config.js && \
        echo "Replacement done for Apps Script URL"; \
    else \
        echo "WARNING: GOOGLE_APPS_SCRIPT_URL is empty!"; \
    fi && \
    if [ -n "$RECAPTCHA_SITE_KEY" ] && [ "$RECAPTCHA_SITE_KEY" != "" ]; then \
        echo "Replacing RECAPTCHA_SITE_KEY..." && \
        sed -i "s|YOUR_RECAPTCHA_SITE_KEY_HERE|${RECAPTCHA_SITE_KEY}|g" /app/js/config.js && \
        echo "Replacement done for reCAPTCHA key"; \
    else \
        echo "WARNING: RECAPTCHA_SITE_KEY is empty!"; \
    fi

# Verify substitution (for debugging)
RUN echo "=== Config.js after substitution ===" && cat /app/js/config.js

# Production stage with Caddy
FROM caddy:2.7-alpine

# Copy processed static files from builder
COPY --from=builder /app/pages /usr/share/caddy/pages
COPY --from=builder /app/components /usr/share/caddy/components
COPY --from=builder /app/css /usr/share/caddy/css
COPY --from=builder /app/js /usr/share/caddy/js
COPY --from=builder /app/media /usr/share/caddy/media


# Set working directory
WORKDIR /usr/share/caddy

# Expose ports
EXPOSE 80 443

# Default command - Caddy will use the mounted Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]