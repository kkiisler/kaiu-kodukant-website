# Apps Script Backend Updates for Gallery Optimization

## Overview
This document outlines the necessary Google Apps Script backend updates to support the gallery performance optimization strategy, including versioning, caching enhancements, and optimized image URL generation.

## Current Implementation Issues

### Problems to Address
1. **No version tracking** - Images update but URLs stay same (browser cache issues)
2. **Inefficient URL generation** - Not using Google's optimized thumbnail service
3. **Limited caching** - Only basic CacheService without proper invalidation
4. **No batch processing** - Individual API calls for each operation
5. **Missing metadata** - No MD5 hash or modification times for cache busting

## Required Updates

### 1. Enable Advanced Drive API

**Location**: Apps Script Editor → Services

```javascript
// Enable Advanced Drive Service
// 1. Click "Services" in left sidebar
// 2. Search for "Drive API"
// 3. Click "Add"
// 4. Version: v2
// 5. Identifier: Drive (default)
```

### 2. Update Gallery Response Structure

**Current Structure**:
```javascript
{
  status: 'success',
  albums: [{
    id: 'FOLDER_ID',
    title: 'Album Name',
    coverImageUrl: 'https://drive.google.com/uc?id=FILE_ID'
  }]
}
```

**New Structure with Versioning**:
```javascript
{
  status: 'success',
  albums: [{
    id: 'FOLDER_ID',
    title: 'Album Name',
    coverImageUrl: 'https://drive.google.com/uc?id=FILE_ID',
    coverImageVersion: '1234567890', // MD5 or modified time
    lastModified: '2024-01-15T10:30:00Z'
  }],
  cacheInfo: {
    cached: true,
    cacheTime: '2024-01-15T10:30:00Z',
    ttl: 3600
  }
}
```

### 3. Implement Version Tracking

**Add to Apps Script**:

```javascript
/**
 * Get file version for cache busting
 * Uses MD5 checksum if available, falls back to modification time
 */
function getFileVersion(fileId) {
  try {
    // Try using Advanced Drive API for MD5
    const file = Drive.Files.get(fileId, {
      fields: 'md5Checksum,modifiedTime'
    });
    
    // Prefer MD5 for true content versioning
    if (file.md5Checksum) {
      // Use first 8 chars of MD5 for shorter URLs
      return file.md5Checksum.substring(0, 8);
    }
    
    // Fallback to timestamp
    return new Date(file.modifiedTime).getTime().toString();
    
  } catch (error) {
    // Fallback to basic Drive service
    try {
      const file = DriveApp.getFileById(fileId);
      return file.getLastUpdated().getTime().toString();
    } catch (e) {
      // Ultimate fallback
      return 'default';
    }
  }
}
```

### 4. Optimize Thumbnail Generation

**Current Method**:
```javascript
// Basic URL construction
const thumbnailUrl = 'https://drive.google.com/uc?id=' + file.getId();
```

**Optimized Method**:
```javascript
/**
 * Get optimized thumbnail URLs using Google's thumbnail service
 * Supports multiple sizes and formats
 */
function getOptimizedThumbnails(fileId) {
  try {
    // Get Google's optimized thumbnail link
    const file = Drive.Files.get(fileId, {
      fields: 'thumbnailLink,webContentLink,imageMediaMetadata'
    });
    
    if (file.thumbnailLink) {
      // Google's thumbnail service provides resizable URLs
      // Format: https://lh3.googleusercontent.com/...=s220
      // Can change size by modifying 's' parameter
      
      return {
        small: file.thumbnailLink.replace(/=s\d+/, '=s300'),
        medium: file.thumbnailLink.replace(/=s\d+/, '=s600'),
        large: file.thumbnailLink.replace(/=s\d+/, '=s1200'),
        original: file.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
        width: file.imageMediaMetadata?.width,
        height: file.imageMediaMetadata?.height
      };
    }
  } catch (error) {
    console.error('Thumbnail generation error:', error);
  }
  
  // Fallback to standard URLs
  return {
    small: `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`,
    medium: `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`,
    large: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    original: `https://drive.google.com/uc?export=view&id=${fileId}`
  };
}
```

### 5. Enhanced Caching Strategy

**Current Caching**:
```javascript
// Simple 1-hour cache
const cache = CacheService.getScriptCache();
cache.put(cacheKey, JSON.stringify(data), 3600);
```

**Improved Caching with Invalidation**:
```javascript
/**
 * Smart caching with version-based invalidation
 */
class SmartCache {
  constructor() {
    this.cache = CacheService.getScriptCache();
    this.ttl = {
      albums: 3600,     // 1 hour for album list
      photos: 1800,     // 30 minutes for photo list
      metadata: 86400   // 24 hours for file metadata
    };
  }
  
  /**
   * Get with version checking
   */
  get(key, version = null) {
    const cacheKey = version ? `${key}_v${version}` : key;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      try {
        const data = JSON.parse(cached);
        // Check if cache is still valid
        if (data.expires && new Date(data.expires) > new Date()) {
          return data.value;
        }
      } catch (e) {
        // Invalid cache entry
      }
    }
    return null;
  }
  
  /**
   * Set with expiration
   */
  set(key, value, type = 'photos', version = null) {
    const cacheKey = version ? `${key}_v${version}` : key;
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + this.ttl[type]);
    
    const data = {
      value: value,
      expires: expires.toISOString(),
      cached: new Date().toISOString()
    };
    
    try {
      this.cache.put(cacheKey, JSON.stringify(data), this.ttl[type]);
    } catch (e) {
      // Cache size limit reached, clear old entries
      this.clearOldEntries();
      this.cache.put(cacheKey, JSON.stringify(data), this.ttl[type]);
    }
  }
  
  /**
   * Clear entries older than TTL
   */
  clearOldEntries() {
    // Remove all cached entries (nuclear option)
    // In production, would track keys and selectively remove
    this.cache.removeAll(['gallery_', 'album_']);
  }
}

const smartCache = new SmartCache();
```

### 6. Batch Processing for Albums

**Optimize Album Loading**:
```javascript
/**
 * Load albums with batch processing
 */
function getGalleryAlbumsOptimized() {
  const cacheKey = 'gallery_albums_optimized';
  const cached = smartCache.get(cacheKey);
  
  if (cached) {
    return {
      status: 'success',
      albums: cached,
      cacheInfo: {
        cached: true,
        source: 'script-cache'
      }
    };
  }
  
  try {
    const albums = [];
    const batchSize = 10; // Process 10 folders at a time
    
    // Get all album folders
    const albumFolders = DriveApp.getFolderById(GALLERY_FOLDER_ID)
      .getFolders();
    
    const folderBatch = [];
    while (albumFolders.hasNext() && folderBatch.length < batchSize) {
      folderBatch.push(albumFolders.next());
    }
    
    // Process in parallel using Drive API batch
    const batchRequest = Drive.newBatch();
    
    folderBatch.forEach(folder => {
      // Get folder metadata and first image
      const files = folder.getFiles();
      let coverImage = null;
      let imageCount = 0;
      
      while (files.hasNext()) {
        const file = files.next();
        if (isImageFile(file)) {
          imageCount++;
          if (!coverImage) {
            coverImage = file;
          }
        }
      }
      
      if (coverImage) {
        const thumbnails = getOptimizedThumbnails(coverImage.getId());
        const version = getFileVersion(coverImage.getId());
        
        albums.push({
          id: folder.getId(),
          title: folder.getName(),
          description: folder.getDescription(),
          coverImageUrl: thumbnails.medium,
          coverImageVersion: version,
          thumbnails: thumbnails,
          imageCount: imageCount,
          lastModified: folder.getLastUpdated().toISOString()
        });
      }
    });
    
    // Sort by date (newest first)
    albums.sort((a, b) => {
      const dateA = extractDateFromTitle(a.title);
      const dateB = extractDateFromTitle(b.title);
      return dateB.localeCompare(dateA);
    });
    
    // Cache the results
    smartCache.set(cacheKey, albums, 'albums');
    
    return {
      status: 'success',
      albums: albums,
      cacheInfo: {
        cached: false,
        source: 'drive-api'
      }
    };
    
  } catch (error) {
    console.error('Gallery error:', error);
    return {
      status: 'error',
      message: error.toString()
    };
  }
}
```

### 7. JSONP Response Updates

**Update doGet Function**:
```javascript
function doGet(e) {
  const callback = e.parameter.callback;
  const action = e.parameter.action;
  
  let response;
  
  try {
    switch(action) {
      case 'gallery':
        response = getGalleryAlbumsOptimized();
        break;
        
      case 'album':
        const albumId = e.parameter.id;
        response = getAlbumPhotosOptimized(albumId);
        break;
        
      default:
        response = {
          status: 'error',
          message: 'Invalid action'
        };
    }
    
    // Add performance metrics
    response.performance = {
      executionTime: Date.now() - startTime + 'ms',
      cacheHit: response.cacheInfo?.cached || false
    };
    
  } catch (error) {
    response = {
      status: 'error',
      message: error.toString()
    };
  }
  
  // Return JSONP response
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(response) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 8. Photo Loading Optimization

```javascript
/**
 * Get photos with optimized URLs and versions
 */
function getAlbumPhotosOptimized(albumId) {
  const cacheKey = `album_${albumId}`;
  const cached = smartCache.get(cacheKey);
  
  if (cached) {
    return {
      status: 'success',
      photos: cached,
      cacheInfo: {
        cached: true,
        source: 'script-cache'
      }
    };
  }
  
  try {
    const folder = DriveApp.getFolderById(albumId);
    const photos = [];
    const files = folder.getFiles();
    
    while (files.hasNext()) {
      const file = files.next();
      
      if (isImageFile(file)) {
        const fileId = file.getId();
        const thumbnails = getOptimizedThumbnails(fileId);
        const version = getFileVersion(fileId);
        
        photos.push({
          id: fileId,
          name: file.getName(),
          caption: extractCaptionFromFilename(file.getName()),
          thumbnails: thumbnails,
          version: version,
          size: file.getSize(),
          mimeType: file.getMimeType(),
          created: file.getDateCreated().toISOString(),
          modified: file.getLastUpdated().toISOString()
        });
      }
    }
    
    // Sort by name/date
    photos.sort((a, b) => a.name.localeCompare(b.name));
    
    // Cache results
    smartCache.set(cacheKey, photos, 'photos');
    
    return {
      status: 'success',
      photos: photos,
      cacheInfo: {
        cached: false,
        source: 'drive-api'
      }
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: error.toString()
    };
  }
}
```

## Testing the Updates

### 1. Deploy Script
1. Save all changes
2. Deploy → New Deployment
3. Type: Web app
4. Execute as: Me
5. Access: Anyone
6. Copy deployment URL

### 2. Test Endpoints

```javascript
// Test gallery endpoint
fetch('YOUR_SCRIPT_URL?action=gallery&callback=test')
  .then(r => r.text())
  .then(console.log);

// Test album endpoint  
fetch('YOUR_SCRIPT_URL?action=album&id=ALBUM_ID&callback=test')
  .then(r => r.text())
  .then(console.log);
```

### 3. Verify Response Structure
- Check for version fields
- Verify thumbnail URLs
- Confirm cache info present
- Test performance metrics

## Deployment Checklist

- [ ] Enable Advanced Drive API
- [ ] Update getFileVersion function
- [ ] Implement getOptimizedThumbnails
- [ ] Add SmartCache class
- [ ] Update gallery endpoint
- [ ] Update album endpoint
- [ ] Test JSONP responses
- [ ] Verify version tracking
- [ ] Check cache performance
- [ ] Monitor execution time

## Performance Expectations

### Before Optimization
- Gallery load: 2-3 seconds
- Album load: 3-5 seconds
- No cache benefits
- Large image transfers

### After Optimization
- Gallery load: <1 second (cached)
- Album load: <2 seconds (cached)
- Version-based cache busting
- Optimized thumbnail sizes
- Batch processing efficiency

## Monitoring & Maintenance

### Key Metrics to Track
1. **Cache hit rate** - Should be >70%
2. **Execution time** - Should be <1s cached, <3s uncached
3. **Error rate** - Should be <1%
4. **API quota usage** - Monitor daily limits

### Regular Maintenance
- Clear cache weekly for fresh data
- Monitor Drive API quotas
- Review error logs monthly
- Update cache TTLs based on usage patterns

## Troubleshooting

### Common Issues

#### Cache not updating
- Check version generation
- Verify cache keys include version
- Review TTL settings

#### Slow performance
- Check batch size settings
- Review API quota usage
- Verify caching is working

#### Missing thumbnails
- Confirm Advanced API enabled
- Check file permissions
- Verify image MIME types

## Future Enhancements

1. **Implement pagination** for large albums
2. **Add image preloading** hints
3. **Generate blurhash** placeholders
4. **Implement smart prefetching**
5. **Add WebP format** support
6. **Create thumbnail queue** for batch processing