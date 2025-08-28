#!/bin/bash
# Clean up all containers and deploy fresh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Cleaning up all existing containers...${NC}"

# Stop ALL kaiumtu containers
echo "Stopping all kaiumtu containers..."
docker stop kaiumtu-caddy kaiumtu-production kaiumtu-web 2>/dev/null || true

# Remove ALL kaiumtu containers
echo "Removing all kaiumtu containers..."
docker rm kaiumtu-caddy kaiumtu-production kaiumtu-web 2>/dev/null || true

# Also stop any containers from compose files
docker-compose down 2>/dev/null || true
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Clean up any dangling images
echo -e "${GREEN}Cleaning up Docker system...${NC}"
docker system prune -f

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env file from .env.example and set your values"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo -e "${GREEN}Environment loaded for domain: ${DOMAIN_NAME}${NC}"

# Make sure no containers are running on ports 80/443
echo -e "${GREEN}Checking ports 80 and 443...${NC}"
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port 80 is in use${NC}"
    lsof -Pi :80 -sTCP:LISTEN
fi

if lsof -Pi :443 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Port 443 is in use${NC}"
    lsof -Pi :443 -sTCP:LISTEN
fi

# Build fresh image
echo -e "${GREEN}Building fresh production image...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start ONLY the production container
echo -e "${GREEN}Starting production container...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for startup
sleep 5

# Check status
echo -e "${GREEN}Checking container status...${NC}"
docker ps | grep kaiumtu || true

# Check logs
echo -e "${GREEN}Recent logs:${NC}"
docker logs --tail 20 kaiumtu-production

# Verify config injection
echo -e "${GREEN}Verifying configuration...${NC}"
if docker exec kaiumtu-production cat /usr/share/caddy/js/config.js 2>/dev/null | grep -q "YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE"; then
    echo -e "${RED}✗ Variables NOT injected properly${NC}"
else
    echo -e "${GREEN}✓ Variables injected successfully${NC}"
fi

echo -e "${GREEN}Done! Check status with: docker ps${NC}"