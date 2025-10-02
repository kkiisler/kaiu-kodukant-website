#!/bin/bash

# ============================================
# MTÜ Kaiu Kodukant - Deployment Script
# ============================================
# This script builds and deploys the website and API
# Usage: ./deploy.sh [options]
#   Options:
#     --build-only    Only build containers, don't deploy
#     --no-cache      Build without Docker cache
#     --api-only      Only deploy API container
#     --web-only      Only deploy web container
#     --logs          Show logs after deployment
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
PROJECT_NAME="kaiumtu"

# Parse command line arguments
BUILD_ONLY=false
NO_CACHE=""
API_ONLY=false
WEB_ONLY=false
SHOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --api-only)
            API_ONLY=true
            shift
            ;;
        --web-only)
            WEB_ONLY=true
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--build-only] [--no-cache] [--api-only] [--web-only] [--logs]"
            exit 1
            ;;
    esac
done

# Functions
print_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

check_requirements() {
    print_step "Checking requirements..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker found"

    # Check if Docker Compose is available
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
        print_success "Docker Compose (plugin) found"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
        print_success "Docker Compose (standalone) found"
    else
        print_error "Docker Compose is not installed"
        exit 1
    fi

    # Check if .env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        print_error ".env file not found!"
        print_warning "Please copy .env.example to .env and configure it:"
        echo "  cp .env.example .env"
        echo "  nano .env"
        exit 1
    fi
    print_success ".env file found"

    # Check if required directories exist
    if [[ ! -d "../api" ]]; then
        print_error "API directory not found at ../api"
        exit 1
    fi
    print_success "API directory found"

    # Check critical environment variables
    source "$ENV_FILE"
    if [[ -z "$DOMAIN_NAME" ]]; then
        print_error "DOMAIN_NAME not set in .env"
        exit 1
    fi
    print_success "Environment variables loaded"
}

build_containers() {
    if [[ "$API_ONLY" == true ]]; then
        print_step "Building API container..."
        $DOCKER_COMPOSE build $NO_CACHE api
    elif [[ "$WEB_ONLY" == true ]]; then
        print_step "Building web container..."
        $DOCKER_COMPOSE build $NO_CACHE web
    else
        print_step "Building all containers..."
        $DOCKER_COMPOSE build $NO_CACHE
    fi
    print_success "Build completed"
}

stop_containers() {
    if [[ "$API_ONLY" == true ]]; then
        print_step "Stopping API container..."
        $DOCKER_COMPOSE stop api
    elif [[ "$WEB_ONLY" == true ]]; then
        print_step "Stopping web container..."
        $DOCKER_COMPOSE stop web
    else
        print_step "Stopping existing containers..."
        $DOCKER_COMPOSE down
    fi
}

deploy_containers() {
    if [[ "$API_ONLY" == true ]]; then
        print_step "Starting API container..."
        $DOCKER_COMPOSE up -d api
    elif [[ "$WEB_ONLY" == true ]]; then
        print_step "Starting web container..."
        $DOCKER_COMPOSE up -d web
    else
        print_step "Starting all containers..."
        $DOCKER_COMPOSE up -d
    fi
    print_success "Containers started"
}

wait_for_health() {
    print_step "Waiting for services to be healthy..."

    # Wait for web service
    if [[ "$API_ONLY" != true ]]; then
        echo -n "  Checking web service"
        for i in {1..30}; do
            if curl -sf http://localhost:80 > /dev/null 2>&1; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
            echo -n "."
            sleep 2
        done

        if [[ $i -eq 30 ]]; then
            echo -e " ${RED}✗${NC}"
            print_warning "Web service did not become healthy in time"
        fi
    fi

    # Wait for API service
    if [[ "$WEB_ONLY" != true ]]; then
        echo -n "  Checking API service"
        for i in {1..30}; do
            if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
            echo -n "."
            sleep 2
        done

        if [[ $i -eq 30 ]]; then
            echo -e " ${RED}✗${NC}"
            print_warning "API service did not become healthy in time"
        fi
    fi
}

check_certificates() {
    print_step "Checking SSL certificates..."

    # Check if certificates directory exists
    CERT_DIR="caddy_data/caddy/certificates/acme-v02.api.letsencrypt.org-directory"

    if [[ -d "$CERT_DIR" ]]; then
        # Count certificate files
        CERT_COUNT=$(find "$CERT_DIR" -name "*.crt" 2>/dev/null | wc -l)
        if [[ $CERT_COUNT -gt 0 ]]; then
            print_success "SSL certificates found ($CERT_COUNT certificates)"
        else
            print_warning "No SSL certificates found yet (will be created on first HTTPS request)"
        fi
    else
        print_warning "Certificate directory not found (will be created on first deployment)"
    fi
}

show_status() {
    print_step "Deployment Status"
    echo ""
    $DOCKER_COMPOSE ps
    echo ""

    # Get container IDs
    WEB_CONTAINER=$($DOCKER_COMPOSE ps -q web 2>/dev/null)
    API_CONTAINER=$($DOCKER_COMPOSE ps -q api 2>/dev/null)

    # Show URLs
    print_step "Service URLs"

    if [[ -n "$WEB_CONTAINER" ]] && [[ "$API_ONLY" != true ]]; then
        if docker inspect $WEB_CONTAINER | grep -q '"Status":"running"'; then
            echo -e "  Website:     ${GREEN}https://$DOMAIN_NAME${NC}"
        else
            echo -e "  Website:     ${RED}Not running${NC}"
        fi
    fi

    if [[ -n "$API_CONTAINER" ]] && [[ "$WEB_ONLY" != true ]]; then
        if docker inspect $API_CONTAINER | grep -q '"Status":"running"'; then
            echo -e "  API:         ${GREEN}https://api.$DOMAIN_NAME${NC}"
            echo -e "  API Health:  ${GREEN}https://api.$DOMAIN_NAME/health${NC}"
            echo -e "  Admin Panel: ${GREEN}https://api.$DOMAIN_NAME/admin${NC}"
        else
            echo -e "  API:         ${RED}Not running${NC}"
        fi
    fi

    echo ""

    # Show resource usage
    print_step "Resource Usage"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        $(docker ps --filter "label=com.docker.compose.project=$PROJECT_NAME" -q) 2>/dev/null || true
}

show_logs() {
    print_step "Recent Logs"

    if [[ "$API_ONLY" == true ]]; then
        $DOCKER_COMPOSE logs --tail=50 api
    elif [[ "$WEB_ONLY" == true ]]; then
        $DOCKER_COMPOSE logs --tail=50 web
    else
        $DOCKER_COMPOSE logs --tail=50
    fi
}

cleanup_old_images() {
    print_step "Cleaning up old Docker images..."

    # Remove dangling images
    DANGLING=$(docker images -f "dangling=true" -q)
    if [[ -n "$DANGLING" ]]; then
        docker rmi $DANGLING 2>/dev/null || true
        print_success "Removed dangling images"
    else
        print_success "No dangling images to remove"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}MTÜ Kaiu Kodukant - Deployment Script${NC}"
    echo -e "${BLUE}============================================${NC}"

    # Change to docker directory
    cd "$(dirname "$0")"

    # Check requirements
    check_requirements

    # Build containers
    build_containers

    if [[ "$BUILD_ONLY" == true ]]; then
        print_success "Build completed successfully (--build-only mode)"
        exit 0
    fi

    # Stop existing containers
    stop_containers

    # Deploy new containers
    deploy_containers

    # Wait for services to be healthy
    wait_for_health

    # Check SSL certificates
    check_certificates

    # Show deployment status
    show_status

    # Show logs if requested
    if [[ "$SHOW_LOGS" == true ]]; then
        show_logs
    fi

    # Cleanup old images
    cleanup_old_images

    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  - Check website: https://$DOMAIN_NAME"
    echo "  - Check API health: https://api.$DOMAIN_NAME/health"
    echo "  - View logs: $DOCKER_COMPOSE logs -f"
    echo "  - Stop services: $DOCKER_COMPOSE down"
    echo ""
}

# Handle errors
trap 'print_error "Deployment failed! Check the logs for details."' ERR

# Run main function
main