#!/bin/bash
# Production deployment script with proper environment variable handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting production deployment...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env file from .env.example and set your values"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
if [ -z "$GOOGLE_APPS_SCRIPT_URL" ] || [ "$GOOGLE_APPS_SCRIPT_URL" == "YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE" ]; then
    echo -e "${RED}Error: GOOGLE_APPS_SCRIPT_URL not set in .env${NC}"
    exit 1
fi

if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" == "localhost" ]; then
    echo -e "${YELLOW}Warning: Using domain: ${DOMAIN_NAME}${NC}"
fi

echo -e "${GREEN}Environment variables loaded:${NC}"
echo "  DOMAIN_NAME: $DOMAIN_NAME"
echo "  GOOGLE_APPS_SCRIPT_URL: ${GOOGLE_APPS_SCRIPT_URL:0:50}..."
echo "  RECAPTCHA_SITE_KEY: ${RECAPTCHA_SITE_KEY:0:10}..."

# Stop existing containers
echo -e "${GREEN}Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down

# Build with arguments
echo -e "${GREEN}Building production image with injected variables...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start production
echo -e "${GREEN}Starting production container...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for container to start
echo -e "${GREEN}Waiting for container to start...${NC}"
sleep 5

# Verify deployment
echo -e "${GREEN}Verifying deployment...${NC}"
CONTAINER_NAME="kaiumtu-production"

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${GREEN}✓ Container is running${NC}"
else
    echo -e "${RED}✗ Container is not running${NC}"
    docker logs $CONTAINER_NAME
    exit 1
fi

# Check if config.js has actual values
CONFIG_CHECK=$(docker exec $CONTAINER_NAME cat /usr/share/caddy/js/config.js | grep -c "YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE" || true)
if [ "$CONFIG_CHECK" -eq "0" ]; then
    echo -e "${GREEN}✓ Environment variables successfully injected${NC}"
else
    echo -e "${RED}✗ Environment variables NOT injected${NC}"
    echo "Debug: Content of config.js:"
    docker exec $CONTAINER_NAME head -20 /usr/share/caddy/js/config.js
    exit 1
fi

echo -e "${GREEN}Deployment successful!${NC}"
echo ""
echo "Your site should be available at:"
echo "  https://$DOMAIN_NAME"
echo ""
echo "To check logs: docker logs -f $CONTAINER_NAME"
echo "To check config: docker exec $CONTAINER_NAME cat /usr/share/caddy/js/config.js"