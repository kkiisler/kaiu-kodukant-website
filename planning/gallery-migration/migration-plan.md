# Gallery Migration Technical Plan

## 1. Current Implementation Analysis

### 1.1 Frontend (gallery.js)

#### Current S3 Implementation
```javascript
// Configuration
const S3_BASE_URL = 'https://s3.pilw.io/kaiugalerii/';

// Album loading
const response = await fetch(S3_BASE_URL + 'albums.xml');
const xml = parser.parseFromString(text, 'text/xml');
const albums = Array.from(xml.querySelectorAll('album')).map(album => ({
    id: album.querySelector('id').textContent,
    title: album.querySelector('title').textContent,
    // ... XML parsing
}));

// Photo loading
const response = await fetch(S3_BASE_URL + albumId + '/photos.xml');
```

#### Issues with Current Approach
- Requires manual XML file maintenance
- No automatic metadata extraction
- Separate thumbnail generation needed
- CORS issues possible with S3
- Additional costs for S3 storage/bandwidth

### 1.2 Backend (apps-script-backend.js)

#### Existing Google Drive Implementation
The backend already has complete implementation:

```javascript
// Gallery endpoints
GET ?action=gallery     → getGalleryData()     // List albums
GET ?action=album&id=X  → getAlbumPhotos(X)    // List photos

// Features implemented
- Automatic folder scanning
- Metadata extraction from filenames
- Cover image detection
- info.txt parsing for descriptions
- Image optimization URLs
- Caching (30min albums, 60min photos)
```

## 2. Migration Architecture

### 2.1 Data Flow Comparison

#### Before (S3)
```
User Request
    ↓
gallery.js
    ↓
Fetch XML from S3
    ↓
Parse XML
    ↓
Display Data
```

#### After (Google Drive)
```
User Request
    ↓
gallery.js
    ↓
Fetch JSON from Apps Script
    ↓
Apps Script (with caching)
    ↓
Google Drive API
    ↓
Return Optimized Data
```

### 2.2 API Response Format Changes

#### S3 XML Response (albums.xml)
```xml
<albums>
  <album>
    <id>2024-suvefestival</id>
    <title>Suvefestival 2024</title>
    <date>15. juuli 2024</date>
    <coverImage>2024-suvefestival/cover.jpg</coverImage>
    <imageCount>25</imageCount>
  </album>
</albums>
```

#### Google Drive JSON Response
```json
{
  "status": "success",
  "albums": [{
    "id": "1ABC...XYZ",  // Drive folder ID
    "title": "Suvefestival 2024",
    "date": "15. juuli 2024",
    "description": "Traditsioonilline suvefestival",
    "coverImageUrl": "https://drive.google.com/uc?id=...&sz=w600",
    "imageCount": 25,
    "dateCreated": "2024-07-15T10:00:00.000Z"
  }],
  "cached": false,
  "count": 1
}
```

## 3. Frontend Implementation Changes

### 3.1 Configuration Update

```javascript
// REMOVE:
const S3_BASE_URL = 'https://s3.pilw.io/kaiugalerii/';

// ADD:
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL';
```

### 3.2 initializeGallery() Function

```javascript
async function initializeGallery() {
    if (galleryInitialized) return;
    galleryInitialized = true;
    
    albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galeriide laadimine...</p>';
    
    try {
        // NEW: Fetch from Apps Script instead of S3
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=gallery`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.albums) {
            console.log(`Loaded ${data.albums.length} albums${data.cached ? ' (cached)' : ''}`);
            displayAlbums(data.albums);
        } else {
            throw new Error(data.message || 'Failed to load albums');
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        loadExampleGalleryData();
    }
}
```

### 3.3 loadAlbum() Function

```javascript
async function loadAlbum(albumId, title, description) {
    albumView.classList.add('hidden');
    photoView.classList.remove('hidden');
    window.scrollTo(0, 0);
    photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Piltide laadimine...</p>';
    
    currentAlbumTitle = title;
    currentAlbumDescription = description;
    
    // Handle example albums
    if (albumId.startsWith('example')) {
        loadExampleAlbumData(albumId, title, description);
        return;
    }
    
    try {
        // NEW: Fetch from Apps Script with album ID
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=album&id=${albumId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.photos) {
            console.log(`Loaded ${data.photos.length} photos${data.cached ? ' (cached)' : ''}`);
            displayAlbumPhotos(data.photos);
        } else {
            throw new Error(data.message || 'Failed to load photos');
        }
    } catch (error) {
        console.error('Error loading album:', error);
        loadExampleAlbumData(albumId, title, description);
    }
}
```

### 3.4 Display Functions

No changes needed to `displayAlbums()` and `displayAlbumPhotos()` - they already work with the expected data format.

## 4. Backend Configuration

### 4.1 Required Configuration

In `apps-script-backend.js` line 18:
```javascript
const GALLERY_DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID'; // Replace with actual
```

### 4.2 Google Drive Folder Structure

```
📁 Kaiu Galerii (get ID from URL when viewing folder)
    │
    ├── 📁 2024-Suvefestival
    │   ├── 🖼️ cover.jpg (optional, else first image)
    │   ├── 🖼️ festival-001.jpg
    │   ├── 🖼️ festival-002.jpg
    │   └── 📄 info.txt (optional)
    │           Line 1: 15. juuli 2024
    │           Line 2+: Album description
    │
    └── 📁 2024-Kevadkorrastus
        ├── 🖼️ korrastus-001.jpg
        └── 📄 info.txt
```

### 4.3 Image URL Optimization

Google Drive automatically serves optimized versions:
```javascript
// Backend generates URLs like:
`https://drive.google.com/uc?id=${fileId}&sz=w${size}`

// Sizes used:
- w600: Cover images
- w400: Thumbnails
- w1200: Full size viewing
```

## 5. Caching Strategy

### 5.1 Cache Layers

1. **Apps Script Cache** (Server-side)
   - Albums: 30 minutes
   - Photos: 60 minutes
   - Key benefit: Reduces Drive API calls

2. **Browser Cache** (Client-side)
   - Images cached by browser
   - JSON responses can be cached with appropriate headers

3. **Lazy Loading** (Already implemented)
   - Preloads full images when thumbnails visible
   - Improves perceived performance

### 5.2 Cache Invalidation

Manual cache clearing in Apps Script:
```javascript
function clearGalleryCaches() {
  const cache = CacheService.getScriptCache();
  cache.remove('gallery_albums');
  // Also clears album photo caches
}
```

## 6. Performance Optimizations

### 6.1 Image Loading Strategy

```javascript
// Thumbnail first, then preload full image
thumbnailUrl: getOptimizedImageUrl(file.getId(), 400),
url: getOptimizedImageUrl(file.getId(), 1200),
```

### 6.2 Batch Operations

Backend fetches all folder contents in one API call:
```javascript
const files = folder.getFiles(); // Single API call
while (files.hasNext()) {
    // Process files
}
```

## 7. Error Handling

### 7.1 Graceful Degradation

```javascript
// Multiple fallback levels:
1. Try Google Drive API
2. Return cached data if available
3. Return example data
4. Show error message
```

### 7.2 User Feedback

```javascript
// Loading states
albumGrid.innerHTML = '<p>Galeriide laadimine...</p>';

// Error messages
albumGrid.innerHTML = '<p>Viga galerii laadimisel. Proovi hiljem uuesti.</p>';

// Empty states
albumGrid.innerHTML = '<p>Galeriis pole veel albumeid.</p>';
```

## 8. Security Considerations

### 8.1 Access Control
- No API keys in frontend
- CORS protection via Apps Script
- Domain restrictions in Apps Script

### 8.2 Data Privacy
- Photos served directly from Google Drive
- No intermediate storage
- Respects Drive sharing permissions

## 9. Migration Steps

### Step 1: Frontend Updates
1. Update gallery.js configuration
2. Replace XML fetching with JSON API calls
3. Remove all S3-related code
4. Remove example gallery functions
5. Update error handling to show proper messages

### Step 2: Backend Configuration
1. Set GALLERY_DRIVE_FOLDER_ID
2. Create folder structure in Drive
3. Grant Apps Script permissions

### Step 3: Data Migration
1. Create albums as folders
2. Upload photos to folders
3. Add optional info.txt files
4. Set cover images if desired

### Step 4: Testing
1. Test album loading
2. Test photo viewing
3. Test lightbox
4. Verify caching

### Step 5: Deployment
1. Deploy Apps Script changes
2. Upload frontend changes
3. Update documentation
4. Monitor performance

## 10. Error Handling Strategy

If issues occur:
1. **No Gallery Data**: Show "Galerii on hetkel tühi" message
2. **Loading Error**: Show "Viga galerii laadimisel" with retry option
3. **Debug**: Check Apps Script logs for errors
4. **Support**: Clear error messages for users

---

*Document Version: 1.0*  
*Technical Specification*  
*Last Updated: November 2024*