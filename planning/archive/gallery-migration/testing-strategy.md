# Gallery Migration Testing Strategy

## Testing Overview
Comprehensive testing plan to ensure smooth migration from S3 to Google Drive gallery system.

## 1. Test Environment Setup

### 1.1 Google Drive Test Structure
```
📁 Kaiu Galerii Test/
├── 📁 2024-Test-Empty/              # Empty album (should be skipped)
├── 📁 2024-Test-Basic/              # Basic album (3-5 photos)
│   ├── 🖼️ photo1.jpg
│   ├── 🖼️ photo2.jpg
│   └── 🖼️ photo3.jpg
├── 📁 2024-Test-With-Cover/         # Album with cover
│   ├── 🖼️ cover.jpg
│   ├── 🖼️ event1.jpg
│   └── 🖼️ event2.jpg
├── 📁 2024-Test-With-Info/          # Album with metadata
│   ├── 📄 info.txt
│   ├── 🖼️ test1.jpg
│   └── 🖼️ test2.jpg
├── 📁 2024-Test-Large/              # Performance test (20+ photos)
│   ├── 🖼️ photo01.jpg
│   ├── 🖼️ photo02.jpg
│   └── ... (20+ files)
└── 📁 2024-Test-Special-Chars/      # Estonian characters
    ├── 🖼️ pühapäev.jpg
    └── 🖼️ õhtusöök.jpg
```

### 1.2 Test Data Preparation

#### info.txt Examples
```
# Basic info.txt
25. november 2024
Test album kirjeldus

# Extended info.txt
1. detsember 2024
Pikk kirjeldus mitme reaga.
See on teine rida.
Ja kolmas rida ka.
```

## 2. Unit Testing

### 2.1 Backend API Tests

#### Test: Gallery Endpoint
```javascript
// Test URL: YOUR_SCRIPT_URL?action=gallery

// Expected Response:
{
  "status": "success",
  "albums": [
    {
      "id": "folder_id",
      "title": "Test Basic",
      "date": "25. november 2024",
      "coverImageUrl": "https://drive.google.com/...",
      "imageCount": 3
    }
  ],
  "cached": false,
  "count": 1
}

// Validation:
- ✓ status === "success"
- ✓ albums is array
- ✓ each album has required fields
- ✓ imageCount matches actual files
```

#### Test: Album Endpoint
```javascript
// Test URL: YOUR_SCRIPT_URL?action=album&id=FOLDER_ID

// Expected Response:
{
  "status": "success",
  "photos": [
    {
      "id": "file_id",
      "name": "photo1.jpg",
      "url": "https://drive.google.com/uc?id=...&sz=w1200",
      "thumbnailUrl": "https://drive.google.com/uc?id=...&sz=w400",
      "caption": "photo1"
    }
  ],
  "cached": false,
  "count": 3
}

// Validation:
- ✓ status === "success"
- ✓ photos is array
- ✓ URLs are properly formatted
- ✓ thumbnailUrl uses w400 size
- ✓ url uses w1200 size
```

### 2.2 Frontend Function Tests

#### Test: Configuration
```javascript
console.assert(GOOGLE_APPS_SCRIPT_URL !== undefined, "Apps Script URL not configured");
console.assert(!window.S3_BASE_URL, "S3 URL should be removed");
```

#### Test: Album Loading
```javascript
// Mock response
const mockAlbums = {
  status: "success",
  albums: [/* test data */]
};

// Test displayAlbums function
displayAlbums(mockAlbums.albums);
const albumElements = document.querySelectorAll('.album-card');
console.assert(albumElements.length === mockAlbums.albums.length, "Album count mismatch");
```

## 3. Integration Testing

### 3.1 End-to-End Scenarios

#### Scenario 1: First Visit
```
1. User opens gallery.html
2. → Loading message appears
3. → Albums fetch from Apps Script
4. → Albums display in grid
5. → Click on album
6. → Photos load
7. → Click on photo
8. → Lightbox opens
9. → Navigate with arrows
10. → Close lightbox
```

#### Scenario 2: Cached Data
```
1. User opens gallery (2nd time)
2. → Cached data loads (faster)
3. → Check console for "cached: true"
4. → Verify same content displayed
```

#### Scenario 3: Error Recovery
```
1. Simulate network error
2. → Error caught
3. → Example gallery loads
4. → User sees placeholder content
5. → No broken UI
```

### 3.2 Cross-Browser Testing

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

### 3.3 Device Testing

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## 4. Performance Testing

### 4.1 Load Time Metrics

#### Target Metrics
| Metric | Target | Acceptable |
|--------|--------|------------|
| Initial Load | <2s | <3s |
| Cached Load | <500ms | <1s |
| Image Thumbnail | <1s | <2s |
| Full Image | <3s | <5s |

#### Test Script
```javascript
// Measure load times
const startTime = performance.now();

fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=gallery`)
  .then(response => response.json())
  .then(data => {
    const loadTime = performance.now() - startTime;
    console.log(`Gallery load time: ${loadTime}ms`);
    console.assert(loadTime < 2000, "Load time exceeds 2 seconds");
  });
```

### 4.2 Cache Performance

```javascript
// First load
let firstLoadTime;
fetch(url).then(() => {
  firstLoadTime = performance.now() - start;
});

// Second load (should be cached)
setTimeout(() => {
  const start = performance.now();
  fetch(url).then(() => {
    const cachedLoadTime = performance.now() - start;
    console.assert(cachedLoadTime < firstLoadTime / 2, "Cache not improving performance");
  });
}, 1000);
```

### 4.3 Large Album Test

Test with 50+ photos:
- [ ] Grid renders without lag
- [ ] Scrolling is smooth
- [ ] Lazy loading works
- [ ] Memory usage acceptable

## 5. User Acceptance Testing

### 5.1 Functional Tests

#### Gallery View
- [ ] Albums display in grid
- [ ] Cover images load
- [ ] Titles are readable
- [ ] Date format correct
- [ ] Photo count accurate
- [ ] Hover effects work

#### Album View
- [ ] Back button works
- [ ] Title displays correctly
- [ ] Description shows (if present)
- [ ] Photos in grid layout
- [ ] Thumbnails load quickly
- [ ] Click opens lightbox

#### Lightbox
- [ ] Image displays centered
- [ ] Caption shows
- [ ] Previous/Next buttons work
- [ ] Keyboard navigation (arrows, ESC)
- [ ] Click outside closes
- [ ] X button closes

### 5.2 Content Tests

- [ ] Estonian characters display correctly
- [ ] Long titles wrap properly
- [ ] Missing metadata handled gracefully
- [ ] Empty albums skipped
- [ ] Special characters in filenames work

## 6. Security Testing

### 6.1 Access Control
```javascript
// Test CORS headers
fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=gallery`)
  .then(response => {
    console.log('CORS Headers:', response.headers.get('Access-Control-Allow-Origin'));
  });
```

### 6.2 Input Validation
```javascript
// Test with invalid album ID
fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=album&id=INVALID`)
  .then(response => response.json())
  .then(data => {
    console.assert(data.status === 'error', "Invalid ID should return error");
  });
```

### 6.3 Credential Check
```javascript
// Ensure no API keys in source
const pageSource = document.documentElement.innerHTML;
console.assert(!pageSource.includes('AIza'), "API key found in source!");
console.assert(!pageSource.includes('s3.pilw.io'), "S3 URL still present!");
```

## 7. Error Handling Tests

### 7.1 Network Errors

```javascript
// Simulate offline
window.addEventListener('offline', () => {
  // Try to load gallery
  // Should show error message or cached data
});
```

### 7.2 Invalid Responses

```javascript
// Test malformed JSON
const invalidJSON = "{invalid}";
try {
  JSON.parse(invalidJSON);
} catch (e) {
  console.assert(e instanceof SyntaxError, "Should catch JSON errors");
}
```

### 7.3 Missing Resources

- [ ] Test with deleted album folder
- [ ] Test with corrupted image
- [ ] Test with missing cover.jpg
- [ ] Test with empty info.txt

## 8. Regression Testing

### 8.1 Existing Features
Ensure no regression in:
- [ ] Mobile responsiveness
- [ ] Touch gestures
- [ ] Keyboard shortcuts
- [ ] Browser back button
- [ ] Link sharing

### 8.2 Visual Regression
Compare screenshots:
- [ ] Gallery grid layout
- [ ] Album photo grid
- [ ] Lightbox appearance
- [ ] Mobile view

## 9. Test Automation Script

### Create test-gallery.html
```html
<!DOCTYPE html>
<html>
<head>
    <title>Gallery Test Suite</title>
</head>
<body>
    <h1>Gallery Migration Test Suite</h1>
    <div id="results"></div>
    
    <script>
        const GOOGLE_APPS_SCRIPT_URL = 'YOUR_URL_HERE';
        const results = document.getElementById('results');
        
        async function runTests() {
            const tests = [
                testConfiguration,
                testGalleryEndpoint,
                testAlbumEndpoint,
                testCaching,
                testErrorHandling
            ];
            
            for (const test of tests) {
                try {
                    await test();
                    logResult(`✅ ${test.name} passed`);
                } catch (e) {
                    logResult(`❌ ${test.name} failed: ${e.message}`);
                }
            }
        }
        
        function logResult(message) {
            results.innerHTML += `<p>${message}</p>`;
        }
        
        async function testConfiguration() {
            if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL.includes('YOUR_')) {
                throw new Error('Apps Script URL not configured');
            }
        }
        
        async function testGalleryEndpoint() {
            const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=gallery`);
            const data = await response.json();
            if (data.status !== 'success') {
                throw new Error('Gallery endpoint failed');
            }
        }
        
        async function testAlbumEndpoint() {
            // Get first album
            const galleryResponse = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=gallery`);
            const galleryData = await galleryResponse.json();
            
            if (galleryData.albums && galleryData.albums.length > 0) {
                const albumId = galleryData.albums[0].id;
                const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=album&id=${albumId}`);
                const data = await response.json();
                
                if (data.status !== 'success') {
                    throw new Error('Album endpoint failed');
                }
            }
        }
        
        async function testCaching() {
            // Test cache by making two requests
            const start1 = performance.now();
            await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=gallery`);
            const time1 = performance.now() - start1;
            
            const start2 = performance.now();
            const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=gallery`);
            const time2 = performance.now() - start2;
            const data = await response.json();
            
            if (!data.cached && time2 >= time1) {
                console.warn('Caching might not be working optimally');
            }
        }
        
        async function testErrorHandling() {
            // Test with invalid action
            const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=invalid`);
            const data = await response.json();
            
            if (data.status !== 'error') {
                throw new Error('Error handling not working');
            }
        }
        
        // Run tests on load
        runTests();
    </script>
</body>
</html>
```

## 10. Acceptance Criteria

### Minimum Viable Product
- [ ] Albums load and display
- [ ] Photos viewable in lightbox
- [ ] Example fallback works
- [ ] No console errors

### Full Feature Set
- [ ] All albums from Drive visible
- [ ] Metadata (date, description) displays
- [ ] Cover images work
- [ ] Caching improves performance
- [ ] Mobile responsive
- [ ] Keyboard navigation
- [ ] Error messages user-friendly

## 11. Sign-off Checklist

### Technical Sign-off
- [ ] All automated tests pass
- [ ] Performance metrics met
- [ ] Security review complete
- [ ] Documentation updated

### User Sign-off
- [ ] Gallery displays correctly
- [ ] Navigation intuitive
- [ ] Performance acceptable
- [ ] Mobile experience good

### Deployment Ready
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Monitoring in place
- [ ] Support documentation ready

---

*Test Strategy Version: 1.0*  
*For Gallery Migration Testing*  
*Last Updated: November 2024*