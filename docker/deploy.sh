#!/bin/bash
# Simplified deployment script for MTÜ Kaiu Kodukant Website
# Usage: ./deploy.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MTÜ Kaiu Kodukant Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    if [ -f ../.env ]; then
        echo -e "${YELLOW}Using .env from parent directory${NC}"
        cp ../.env .env
    else
        echo -e "${RED}Error: .env file not found!${NC}"
        echo "Please create .env file from .env.example:"
        echo "  cp ../.env.example docker/.env"
        echo "  nano .env  # Edit with your values"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Validate required variables
if [ -z "$GOOGLE_APPS_SCRIPT_URL" ] || [ "$GOOGLE_APPS_SCRIPT_URL" = "YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE" ]; then
    echo -e "${RED}Error: GOOGLE_APPS_SCRIPT_URL not configured in .env${NC}"
    exit 1
fi

if [ -z "$DOMAIN_NAME" ]; then
    echo -e "${YELLOW}Warning: DOMAIN_NAME not set, using 'localhost'${NC}"
    export DOMAIN_NAME="localhost"
fi

echo -e "${GREEN}Configuration:${NC}"
echo "  Domain: $DOMAIN_NAME"
echo "  Apps Script URL: ${GOOGLE_APPS_SCRIPT_URL:0:50}..."
echo ""

# Stop existing container
echo -e "${GREEN}Stopping existing container...${NC}"
docker compose down 2>/dev/null || true

# Remove old images to ensure fresh build
echo -e "${GREEN}Removing old images...${NC}"
docker compose rm -f 2>/dev/null || true
docker image prune -f

# Build fresh image with build args
echo -e "${GREEN}Building Docker image with configuration...${NC}"
docker compose build --no-cache

# Start container
echo -e "${GREEN}Starting container...${NC}"
docker compose up -d

# Wait for container to be healthy
echo -e "${GREEN}Waiting for container to be healthy...${NC}"
sleep 5

# Check status
if docker ps | grep -q kaiumtu; then
    echo -e "${GREEN}✓ Container is running${NC}"
    
    # Show container logs
    echo -e "${GREEN}Recent logs:${NC}"
    docker logs --tail 10 kaiumtu
    
    # Verify configuration was injected
    echo -e "${GREEN}Verifying configuration...${NC}"
    if docker exec kaiumtu grep -q "YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE" /usr/share/caddy/js/config.js 2>/dev/null; then
        echo -e "${RED}✗ Warning: Configuration may not be properly injected${NC}"
    else
        echo -e "${GREEN}✓ Configuration injected successfully${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        echo "Site available at: http://localhost"
    else
        echo "Site available at: https://$DOMAIN_NAME"
    fi
    
    echo ""
    echo "Useful commands:"
    echo "  docker logs -f kaiumtu          # View logs"
    echo "  docker compose restart          # Restart container"
    echo "  docker compose down             # Stop container"
    echo "  docker exec -it kaiumtu sh      # Shell access"
    
else
    echo -e "${RED}✗ Container failed to start${NC}"
    echo -e "${RED}Check logs with: docker compose logs${NC}"
    exit 1
fi