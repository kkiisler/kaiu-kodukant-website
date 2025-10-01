# Gallery Migration Implementation Checklist

## Pre-Migration Tasks
- [ ] Review [migration-plan.md](./migration-plan.md)
- [ ] Access Google Drive account
- [ ] Access Google Apps Script project
- [ ] Backup current gallery.js file
- [ ] Note current S3 bucket structure (if needed for reference)
- [ ] Create test folders in Google Drive

## Phase 1: Google Drive Setup

### Create Folder Structure
- [ ] Create main gallery folder "Kaiu Galerii" in Google Drive
- [ ] Note the folder ID from URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`
- [ ] Share folder with Apps Script service account (if needed)
- [ ] Set permissions to "Editor" for Apps Script

### Create Test Albums
- [ ] Create folder "2024-Test-Album"
- [ ] Upload 3-5 test images
- [ ] Create `info.txt` with:
  ```
  1. november 2024
  Test album kirjeldus testimiseks
  ```
- [ ] Optionally add `cover.jpg` for specific cover image

## Phase 2: Backend Configuration

### Update apps-script-backend.js
- [ ] Locate line 18: `const GALLERY_DRIVE_FOLDER_ID`
- [ ] Replace `'YOUR_GALLERY_FOLDER_ID'` with actual folder ID
- [ ] Save the Apps Script project
- [ ] Deploy new version if needed

### Test Backend Endpoints
- [ ] Test gallery endpoint: `YOUR_SCRIPT_URL?action=gallery`
- [ ] Verify JSON response contains albums
- [ ] Test album endpoint: `YOUR_SCRIPT_URL?action=album&id=FOLDER_ID`
- [ ] Verify JSON response contains photos
- [ ] Check Apps Script logs for any errors

## Phase 3: Frontend Implementation

### Update gallery.js Configuration

#### Remove S3 Configuration (Line 10)
- [ ] Delete or comment out:
```javascript
const S3_BASE_URL = 'https://s3.pilw.io/kaiugalerii/';
```

#### Add Apps Script Configuration
- [ ] Add at top of file:
```javascript
// Configuration - Google Apps Script backend
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL';
```

### Update initializeGallery Function (Lines 84-113)

- [ ] Replace entire function with:
```javascript
async function initializeGallery() {
    if (galleryInitialized) return;
    galleryInitialized = true;
    
    albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galeriide laadimine...</p>';
    
    try {
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
        albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Viga galerii laadimisel. Palun proovi hiljem uuesti.</p>';
    }
}
```

### Update loadAlbum Function (Lines 146-183)

- [ ] Replace album loading section with:
```javascript
async function loadAlbum(albumId, title, description) {
    albumView.classList.add('hidden');
    photoView.classList.remove('hidden');
    window.scrollTo(0, 0);
    photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Piltide laadimine...</p>';
    
    currentAlbumTitle = title;
    currentAlbumDescription = description;
    
    try {
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
        photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Viga piltide laadimisel. Palun proovi hiljem uuesti.</p>';
    }
}
```

### Remove Example Gallery Functions

- [ ] Delete `loadExampleGalleryData()` function (lines 218-239)
- [ ] Delete `loadExampleAlbumData()` function (lines 241-276)
- [ ] Remove any references to example data

### Update gallery.html
- [ ] Add config.js script before gallery.js:
```html
<script src="js/config.js"></script>
<script src="js/common.js"></script>
<script src="js/gallery.js"></script>
```

## Phase 4: Testing

### Create test-gallery.html
- [ ] Create test file similar to test-calendar.html
- [ ] Include configuration check
- [ ] Add album fetch test
- [ ] Add photo fetch test
- [ ] Test response format validation

### Functional Testing
- [ ] Open gallery.html in browser
- [ ] Check browser console for errors
- [ ] Verify albums load and display
- [ ] Click on album to view photos
- [ ] Test photo grid display
- [ ] Click photo to open lightbox
- [ ] Test lightbox navigation (prev/next)
- [ ] Test lightbox close (X button, Escape key, background click)
- [ ] Test "Back to albums" button

### Performance Testing
- [ ] Check initial load time (<2 seconds)
- [ ] Verify caching works (check "cached: true" in console)
- [ ] Test with album containing 20+ photos
- [ ] Verify lazy loading of images

### Error Handling Testing
- [ ] Test with incorrect Apps Script URL
- [ ] Test with invalid folder ID
- [ ] Test network disconnection after page load
- [ ] Verify example gallery loads on error

## Phase 5: Data Migration

### Prepare Google Drive Folders
- [ ] Create production album folders with naming: `YYYY-EventName`
- [ ] Upload photos to each album folder
- [ ] Add info.txt files where needed:
  ```
  {date in Estonian format}
  {optional description}
  ```
- [ ] Set cover images (rename to `cover.jpg` or use first image)

### Album Organization
- [ ] Use consistent naming convention
- [ ] Remove spaces (use dashes)
- [ ] Keep Estonian characters (ä, ö, ü, õ)
- [ ] Sort chronologically by folder name

## Phase 6: Documentation Updates

### Update SETUP.md
- [ ] Remove S3 configuration section
- [ ] Add Google Drive gallery setup section
- [ ] Update troubleshooting for gallery
- [ ] Add folder structure examples

### Update CLAUDE.md
- [ ] Remove S3 references
- [ ] Document Google Drive integration
- [ ] Update configuration section

### Create User Guide
- [ ] Write instructions for adding new albums
- [ ] Document photo upload process
- [ ] Explain info.txt format
- [ ] Include cover image guidelines

## Phase 7: Deployment

### Pre-Deployment Checks
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Backup of original files created
- [ ] Apps Script deployed

### Deploy Changes
- [ ] Upload updated gallery.js
- [ ] Upload updated gallery.html
- [ ] Upload test-gallery.html (for troubleshooting)
- [ ] Clear browser cache

### Post-Deployment Verification
- [ ] Test on production URL
- [ ] Verify all albums visible
- [ ] Test multiple browsers
- [ ] Check mobile responsiveness
- [ ] Monitor Apps Script logs

## Phase 8: Cleanup

### Remove Old Infrastructure
- [ ] Document S3 bucket contents (backup if needed)
- [ ] Remove S3 references from code
- [ ] Delete test-gallery.html after verification
- [ ] Archive old XML files

### Final Verification
- [ ] User acceptance testing
- [ ] Performance benchmarking
- [ ] Security audit (no exposed credentials)
- [ ] Documentation review

## Rollback Plan

If issues occur:
1. [ ] Restore original gallery.js from backup
2. [ ] Restore original gallery.html from backup
3. [ ] Verify S3 bucket still accessible
4. [ ] Check XML files intact
5. [ ] Document issues for resolution

## Success Criteria Checklist

- [ ] ✅ All albums load from Google Drive
- [ ] ✅ Photos display in grid layout
- [ ] ✅ Lightbox functions properly
- [ ] ✅ Navigation works (back button, etc.)
- [ ] ✅ Performance acceptable (<2s load)
- [ ] ✅ Caching reduces subsequent loads
- [ ] ✅ Example gallery fallback works
- [ ] ✅ No console errors in production
- [ ] ✅ Mobile responsive design maintained
- [ ] ✅ Documentation complete and accurate

## Notes Section

**Google Drive Folder ID**: _________________________

**Apps Script URL**: _________________________________

**Issues Encountered**:
_____________________________________________________
_____________________________________________________
_____________________________________________________

**Resolution Time**: _______ hours

**Completed By**: ___________________

**Date**: ___________________________

---

*Checklist Version: 1.0*  
*For Gallery Migration from S3 to Google Drive*