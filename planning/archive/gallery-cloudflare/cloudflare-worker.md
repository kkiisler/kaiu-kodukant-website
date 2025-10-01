# Cloudflare Worker Image Proxy Documentation

## Overview
This document provides complete setup instructions for deploying a Cloudflare Worker to proxy and cache Google Drive images with proper cache headers.

## Architecture

```
User Browser → images.kaiukodukant.ee → Cloudflare Worker → Google Drive
     ↑                    ↓                      ↓              ↓
     └──────── Cached Response ←─── Edge Cache ←─┘              ↓
                                                          Original Image
```

### URL Structure
```
https://images.kaiukodukant.ee/[fileId]/w[width]?v=[version]

Examples:
- https://images.kaiukodukant.ee/1ABC123/w300?v=12345
- https://images.kaiukodukant.ee/2DEF456/w1200?v=67890
```

## Complete Worker Code

### Production-Ready Implementation

```javascript
// Cloudflare Worker: Google Drive Image Proxy with Caching
// Deploy at: images.kaiukodukant.ee

export default {
  async fetch(request, env, ctx) {
    // Configuration
    const ALLOWED_WIDTHS = [300, 400, 600, 800, 1200, 1600];
    const MAX_AGE = 31536000; // 1 year
    const ALLOWED_ORIGINS = [
      'https://kaiukodukant.ee',
      'https://www.kaiukodukant.ee',
      'https://tore.kaiukodukant.ee',
      'http://localhost:3000' // Development
    ];
    
    // Parse request URL
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    
    // CORS handling
    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
    
    // Set CORS origin
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else {
      corsHeaders['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0];
    }
    
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Parse path: /fileId/w300
    const pathMatch = url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/w(\d+)$/);
    
    if (!pathMatch) {
      return new Response('Invalid URL format. Expected: /fileId/w300', { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    const [, fileId, width] = pathMatch;
    const widthNum = parseInt(width);
    
    // Validate width
    if (!ALLOWED_WIDTHS.includes(widthNum)) {
      return new Response(`Invalid width. Allowed: ${ALLOWED_WIDTHS.join(', ')}`, { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Get version from query string
    const version = url.searchParams.get('v') || 'default';
    
    // Build Google Drive URL based on size
    let driveUrl;
    if (widthNum <= 600) {
      // Use thumbnail API for small images (faster)
      driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${widthNum}`;
    } else {
      // Use direct download for large images
      // Note: This doesn't support width parameter, returns original
      driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    // Create cache key including version
    const cacheKey = new Request(
      `https://cache.internal/${fileId}/w${width}?v=${version}`,
      request
    );
    
    const cache = caches.default;
    
    try {
      // Check cache first
      let response = await cache.match(cacheKey);
      
      if (response) {
        // Cache HIT - add headers and return
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers),
            ...corsHeaders,
            'X-Cache-Status': 'HIT',
            'X-Cache-Key': `${fileId}/w${width}/v${version}`
          }
        });
      }
      
      // Cache MISS - fetch from Google Drive
      console.log(`Cache MISS: Fetching ${driveUrl}`);
      
      response = await fetch(driveUrl, {
        headers: {
          'User-Agent': 'Cloudflare-Worker/1.0',
        },
        cf: {
          // Cloudflare fetch options
          cacheEverything: true,
          cacheTtl: 3600, // Cache at CF edge for 1 hour
          mirage: false,
          polish: 'lossy', // Optimize images
        }
      });
      
      // Handle Drive errors
      if (!response.ok) {
        // Don't cache errors
        return new Response(`Drive error: ${response.status}`, {
          status: response.status,
          headers: corsHeaders
        });
      }
      
      // Get content type
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';
      
      // Check if it's actually an image
      if (!contentType.startsWith('image/')) {
        return new Response('Not an image', {
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Create cacheable response with proper headers
      const cacheableResponse = new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${MAX_AGE}, immutable`,
          'X-Cache-Status': 'MISS',
          'X-Cache-Key': `${fileId}/w${width}/v${version}`,
          'X-Original-URL': driveUrl,
          'Timing-Allow-Origin': '*',
          ...corsHeaders
        }
      });
      
      // Store in cache (async)
      ctx.waitUntil(
        cache.put(cacheKey, cacheableResponse.clone())
      );
      
      return cacheableResponse;
      
    } catch (error) {
      // Log error for debugging
      console.error('Worker error:', error);
      
      // Return error response
      return new Response('Internal error', {
        status: 500,
        headers: {
          ...corsHeaders,
          'X-Error': error.message
        }
      });
    }
  }
};
```

## Deployment Steps

### 1. Create Cloudflare Account
1. Sign up at https://cloudflare.com
2. Add your domain (kaiukodukant.ee)
3. Update nameservers if required

### 2. Create Worker
1. Go to Workers & Pages
2. Create Application → Create Worker
3. Name it: `kaiu-gallery-images`
4. Copy the worker code above
5. Save and Deploy

### 3. Configure Custom Domain
1. Go to worker Settings → Triggers
2. Add Custom Domain: `images.kaiukodukant.ee`
3. This automatically creates the DNS record

### 4. Configure Routes (Alternative)
If custom domain doesn't work:
1. Go to Workers → Your Worker → Triggers
2. Add Route: `images.kaiukodukant.ee/*`
3. Zone: `kaiukodukant.ee`

### 5. Add DNS Record
If not automatically created:
1. Go to DNS settings
2. Add CNAME record:
   - Name: `images`
   - Target: `kaiu-gallery-images.workers.dev`
   - Proxy: ON (orange cloud)

## Testing

### Basic Functionality Test
```bash
# Test image proxy
curl -I https://images.kaiukodukant.ee/YOUR_FILE_ID/w300

# Check headers
curl -I https://images.kaiukodukant.ee/YOUR_FILE_ID/w300 | grep -E "Cache-Control|X-Cache"

# Test with version
curl -I https://images.kaiukodukant.ee/YOUR_FILE_ID/w300?v=123
```

### Browser Testing
```javascript
// Test in browser console
fetch('https://images.kaiukodukant.ee/YOUR_FILE_ID/w300')
  .then(r => {
    console.log('Status:', r.status);
    console.log('Cache:', r.headers.get('X-Cache-Status'));
    console.log('Cache-Control:', r.headers.get('Cache-Control'));
    return r.blob();
  })
  .then(blob => console.log('Image size:', blob.size));
```

### Performance Testing
```javascript
// Measure cache performance
async function testCachePerformance(fileId) {
  const url = `https://images.kaiukodukant.ee/${fileId}/w300`;
  
  // First load (MISS)
  const t1 = performance.now();
  const r1 = await fetch(url);
  const time1 = performance.now() - t1;
  
  // Second load (HIT)
  const t2 = performance.now();
  const r2 = await fetch(url);
  const time2 = performance.now() - t2;
  
  console.log({
    firstLoad: `${time1.toFixed(2)}ms (${r1.headers.get('X-Cache-Status')})`,
    secondLoad: `${time2.toFixed(2)}ms (${r2.headers.get('X-Cache-Status')})`,
    improvement: `${((1 - time2/time1) * 100).toFixed(1)}% faster`
  });
}
```

## Monitoring

### Cloudflare Analytics
1. Workers → Analytics
2. Monitor:
   - Request count
   - Error rate
   - Response times
   - Bandwidth usage

### Custom Logging
Add to worker for detailed logging:
```javascript
// Log to Cloudflare Logpush or external service
const logData = {
  timestamp: new Date().toISOString(),
  fileId,
  width,
  version,
  cacheStatus: response.headers.get('X-Cache-Status'),
  responseTime: Date.now() - startTime,
  userAgent: request.headers.get('User-Agent')
};

// Send to analytics endpoint (if configured)
ctx.waitUntil(
  fetch('https://analytics.example.com/log', {
    method: 'POST',
    body: JSON.stringify(logData)
  })
);
```

## Cache Management

### Purge Specific Image
```bash
# Via API
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://images.kaiukodukant.ee/FILE_ID/w300?v=123"]}'
```

### Purge Everything
```bash
# Nuclear option - purge all cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### Automatic Cache Invalidation
When image updates in Drive:
1. Change version parameter in Apps Script
2. New URL = new cache entry
3. Old cache expires naturally

## Cost Optimization

### Free Tier Limits
- 100,000 requests/day
- 10ms CPU time per request
- Unlimited bandwidth

### Staying Within Limits
1. **Aggressive browser caching** (1 year)
2. **Cloudflare edge caching** (1 hour minimum)
3. **Efficient code** (<1ms execution time)

### Cost Monitoring
```javascript
// Add to worker for cost tracking
const requestCount = await env.COUNTER.increment();
if (requestCount % 1000 === 0) {
  console.log(`Processed ${requestCount} requests today`);
}
```

## Troubleshooting

### Common Issues

#### Images not loading
1. Check worker is deployed: `https://images.kaiukodukant.ee/health`
2. Verify DNS propagation: `nslookup images.kaiukodukant.ee`
3. Check CORS headers match your domain
4. Verify Google Drive file permissions

#### Cache not working
1. Check X-Cache-Status header (should be HIT on second load)
2. Verify Cache-Control headers are set
3. Check browser isn't in "Disable cache" mode
4. Clear Cloudflare cache if stale

#### CORS errors
1. Add your domain to ALLOWED_ORIGINS
2. Check Origin header in request
3. Verify preflight handling works

#### Performance issues
1. Check Cloudflare Analytics for slow queries
2. Verify Polish/Mirage settings
3. Check if images are being resized properly
4. Monitor worker CPU time

### Debug Mode
Add debug parameter to get detailed info:
```javascript
if (url.searchParams.get('debug') === 'true') {
  return new Response(JSON.stringify({
    fileId,
    width,
    version,
    driveUrl,
    cacheKey: cacheKey.url,
    headers: Object.fromEntries(request.headers)
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Security Considerations

### Input Validation
- File IDs: Alphanumeric only
- Widths: Predefined list
- Version: Sanitized string

### Rate Limiting
```javascript
// Simple rate limiting
const ip = request.headers.get('CF-Connecting-IP');
const rateLimitKey = `rate_${ip}`;
const requests = await env.RATE_LIMITER.increment(rateLimitKey);

if (requests > 1000) {
  return new Response('Rate limited', { status: 429 });
}
```

### Access Control
- CORS restricted to your domains
- No directory listing
- No path traversal possible

## Future Enhancements

### Advanced Features
1. **WebP conversion** for modern browsers
2. **Blurhash placeholders** for progressive loading
3. **Smart cropping** using Cloudflare Image Resizing
4. **Request coalescing** for duplicate requests
5. **Prefetching** next/previous images

### Performance Optimizations
1. **Early hints** (103 status code)
2. **Service binding** to origin server
3. **Durable Objects** for persistent cache
4. **R2 storage** for permanent image backup

### Monitoring Improvements
1. **Real User Monitoring (RUM)**
2. **Synthetic monitoring**
3. **Alert on error rate increase**
4. **Performance budgets**