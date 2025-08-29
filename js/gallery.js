// Gallery functionality - Google Drive Implementation

// JSONP utility function for cross-origin requests
function jsonp(url, onSuccess, onError) {
    const callbackName = 'jsonp_' + Math.random().toString(36).substring(2, 15);
    const script = document.createElement('script');
    
    window[callbackName] = function(data) {
        delete window[callbackName];
        document.head.removeChild(script);
        if (onSuccess) onSuccess(data);
    };
    
    script.onerror = function() {
        delete window[callbackName];
        document.head.removeChild(script);
        if (onError) onError(new Error('JSONP request failed'));
    };
    
    const separator = url.includes('?') ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName;
    document.head.appendChild(script);
}

let galleryInitialized = false;
let currentAlbumTitle = '';
let currentAlbumDescription = '';
let lightboxPhotos = [];
let currentLightboxIndex = 0;

// Configuration - Google Apps Script backend
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

document.addEventListener('DOMContentLoaded', function() {
    const albumView = document.getElementById('album-view');
    const photoView = document.getElementById('photo-view');
    const albumGrid = document.getElementById('album-grid');
    const photoGrid = document.getElementById('photo-grid');
    const backToAlbumsButton = document.getElementById('back-to-albums');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    if (!albumGrid) return;

    // Initialize gallery
    initializeGallery();

    // Gallery navigation
    if (backToAlbumsButton) {
        backToAlbumsButton.addEventListener('click', () => {
            albumView.classList.remove('hidden');
            photoView.classList.add('hidden');
        });
    }

    // Lightbox controls
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => navigateLightbox(1));
    }

    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (lightbox.classList.contains('flex')) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') navigateLightbox(-1);
                if (e.key === 'ArrowRight') navigateLightbox(1);
            }
        });
    }

    function initializeGallery() {
        if (galleryInitialized) return;
        
        loadGalleryAlbums();
        galleryInitialized = true;
    }

    function loadGalleryAlbums() {
        // Build URL for Apps Script endpoint
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=gallery`;
        
        // Show loading state
        albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galerii laadimine...</p>';
        
        console.log('Fetching gallery from:', url);
        
        // Use JSONP to avoid CORS issues
        jsonp(url, function(data) {
            console.log('Gallery response:', data);
            
            if (data.status === 'success' && data.albums) {
                console.log(`Loaded ${data.albums.length} albums${data.cached ? ' (cached)' : ''}`);
                displayAlbums(data.albums);
            } else if (data.status === 'success' && (!data.albums || data.albums.length === 0)) {
                albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galerii on hetkel tühi.</p>';
            } else {
                console.error('Gallery error:', data.message || 'Failed to load albums');
                loadExampleGallery();
            }
        }, function(error) {
            console.error('Error loading gallery:', error);
            loadExampleGallery();
        });
    }
    
    function loadExampleGallery() {
        const exampleAlbums = [
            {
                id: 'example1',
                title: 'Näidisalbum',
                date: '2024',
                description: 'See on näidisalbum. Palun seadista Google Drive backend.',
                coverImageUrl: '',
                imageCount: 0
            }
        ];
        displayAlbums(exampleAlbums);
    }

    // Normalize Google Drive image URLs to use correct formats
    function normalizeDriveImageUrls({ url, thumbnailUrl, preferWidth = 1600, thumbWidth = 400 }) {
        // If backend already sent the preferred shapes, keep them
        const isUcSz = u => typeof u === 'string' && u.includes('drive.google.com/uc') && /[?&]id=/.test(u) && /[?&]sz=w\d+/.test(u);
        const isThumb = u => typeof u === 'string' && u.includes('drive.google.com/thumbnail') && /[?&]id=/.test(u);

        let fileId = null;

        function extractId(u) {
            if (!u) return null;
            if (/[?&]id=/.test(u)) return u.split('id=')[1].split('&')[0];
            if (u.includes('/file/d/')) return u.split('/file/d/')[1].split('/')[0];
            if (u.includes('/d/')) return u.split('/d/')[1].split('/')[0];
            return null;
        }

        if (isUcSz(url) && isThumb(thumbnailUrl)) {
            return { full: url, thumb: thumbnailUrl };
        }

        fileId = extractId(url) || extractId(thumbnailUrl);
        if (!fileId) return { full: url, thumb: thumbnailUrl }; // give up gracefully

        return {
            full: `https://drive.google.com/uc?id=${fileId}&sz=w${preferWidth}`,
            thumb: `https://drive.google.com/thumbnail?id=${fileId}&sz=w${thumbWidth}`
        };
    }

    function displayAlbums(albums) {
        albumGrid.innerHTML = '';
        
        if (albums.length === 0) {
            albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galerii on hetkel tühi.</p>';
            return;
        }
        
        albums.forEach(album => {
            const albumEl = document.createElement('div');
            albumEl.className = 'album-card cursor-pointer bg-white border border-gray-200 hover:border-gray-300 group';
            
            // Fix Google Drive URL - use direct download link format
            let coverImageHtml = '';
            if (album.coverImageUrl) {
                // Extract file ID from the URL if it's in the format https://drive.google.com/uc?id=FILE_ID
                let imageUrl = album.coverImageUrl;
                if (imageUrl.includes('drive.google.com/uc?id=')) {
                    const fileId = imageUrl.split('id=')[1]?.split('&')[0];
                    if (fileId) {
                        // Use the thumbnail API for cover images
                        imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                    }
                }
                coverImageHtml = `<img src="${imageUrl}" alt="${album.title}" 
                                     class="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                     loading="lazy"
                                     onerror="this.style.display='none'; this.parentElement.classList.add('bg-gradient-to-br', 'from-gray-200', 'to-gray-300')">`;
            } else {
                coverImageHtml = `<div class="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                    <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                  </div>`;
            }
            
            albumEl.innerHTML = `
                <div class="overflow-hidden aspect-square bg-gray-200">
                    ${coverImageHtml}
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">${album.title}</h3>
                    <div class="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <span class="font-medium">${album.date}</span>
                        <span class="bg-gray-100 px-3 py-1 rounded-full">${album.imageCount} pilti</span>
                    </div>
                    ${album.description ? `<p class="text-gray-600 text-sm leading-relaxed">${album.description}</p>` : ''}
                </div>
            `;
            albumEl.addEventListener('click', () => loadAlbumPhotos(album.id, album.title, album.description));
            albumGrid.appendChild(albumEl);
        });
    }

    function loadAlbumPhotos(albumId, title, description) {
        currentAlbumTitle = title || 'Album';
        currentAlbumDescription = description || '';
        
        albumView.classList.add('hidden');
        photoView.classList.remove('hidden');
        
        // Build URL for Apps Script endpoint
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=album&id=${albumId}`;
        
        // Show loading state
        photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Piltide laadimine...</p>';
        
        console.log('Fetching album from:', url);
        
        // Use JSONP to avoid CORS issues
        jsonp(url, function(data) {
            console.log('Album response:', data);
            
            if (data.status === 'success' && data.photos) {
                console.log(`Loaded ${data.photos.length} photos${data.cached ? ' (cached)' : ''}`);
                displayAlbumPhotos(data.photos);
            } else if (data.status === 'success' && (!data.photos || data.photos.length === 0)) {
                photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Selles albumis pole veel pilte.</p>';
            } else {
                console.error('Album error:', data.message || 'Failed to load photos');
                photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Viga piltide laadimisel. Palun proovi hiljem uuesti.</p>';
            }
        }, function(error) {
            console.error('Error loading album:', error);
            photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Viga piltide laadimisel. Palun proovi hiljem uuesti.</p>';
        });
    }

    function displayAlbumPhotos(photos) {
        document.getElementById('photo-album-title').textContent = currentAlbumTitle;
        document.getElementById('photo-album-description').textContent = currentAlbumDescription;

        photoGrid.innerHTML = '';
        lightboxPhotos = [];

        if (photos.length === 0) {
            photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Selles albumis pole veel pilte.</p>';
            return;
        }

        photos.forEach((photo, index) => {
            // Use the normalizer to get correct URLs
            const { full, thumb } = normalizeDriveImageUrls({
                url: photo.url,
                thumbnailUrl: photo.thumbnailUrl,
                preferWidth: 1600,
                thumbWidth: 400
            });

            // Extract file ID for alternate URLs
            let fileId = null;
            if (photo.url && /[?&]id=/.test(photo.url)) {
                fileId = photo.url.split('id=')[1]?.split('&')[0];
            } else if (photo.thumbnailUrl && /[?&]id=/.test(photo.thumbnailUrl)) {
                fileId = photo.thumbnailUrl.split('id=')[1]?.split('&')[0];
            } else if (photo.id) {
                fileId = photo.id;
            }

            lightboxPhotos.push({
                src: full,
                // Keep alternates for fallback attempts
                alt1: fileId ? `https://drive.google.com/uc?id=${fileId}&sz=w1200` : null,
                alt2: fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600` : null,
                caption: photo.caption || photo.name,
                loaded: false
            });

            const photoEl = document.createElement('div');
            photoEl.className = 'photo-thumbnail cursor-pointer overflow-hidden rounded-lg aspect-square bg-gray-200 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300';
            
            photoEl.innerHTML = `
                <img src="${thumb}" 
                     alt="${photo.caption || photo.name}" 
                     loading="lazy" 
                     class="object-cover w-full h-full"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\' viewBox=\\\'0 0 100 100\\\'%3E%3Crect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'%23e5e7eb\\\'/%3E%3Ctext x=\\\'50\\\' y=\\\'50\\\' font-family=\\\'Arial\\\' font-size=\\\'14\\\' fill=\\\'%239ca3af\\\' text-anchor=\\\'middle\\\' dominant-baseline=\\\'middle\\\'%3ENo Image%3C/text%3E%3C/svg%3E'">
            `;
            photoEl.addEventListener('click', () => openLightbox(index));
            photoGrid.appendChild(photoEl);
        });
        
        setupImageLazyLoading();
    }

    function openLightbox(index) {
        currentLightboxIndex = index;
        updateLightboxImage();
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
        lightbox.style.opacity = '0';
        setTimeout(() => {
            lightbox.style.opacity = '1';
        }, 10);
        
        // Preload adjacent images
        preloadAdjacentImages(index);
    }

    function closeLightbox() {
        lightbox.style.opacity = '0';
        setTimeout(() => {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
        }, 300);
    }

    function navigateLightbox(direction) {
        currentLightboxIndex += direction;
        if (currentLightboxIndex < 0) currentLightboxIndex = lightboxPhotos.length - 1;
        if (currentLightboxIndex >= lightboxPhotos.length) currentLightboxIndex = 0;
        updateLightboxImage();
    }

    function updateLightboxImage() {
        const photo = lightboxPhotos[currentLightboxIndex];
        const loader = document.getElementById('lightbox-loader');

        if (loader) loader.classList.remove('hidden');

        // Build list of URLs to try in order
        const tryList = [photo.src, photo.alt1, photo.alt2].filter(Boolean);
        let attempt = 0;

        const img = new Image();

        img.onload = function() {
            lightboxImg.src = img.src;
            lightboxImg.alt = photo.caption;
            lightboxCaption.textContent = photo.caption;
            photo.loaded = true;
            if (loader) loader.classList.add('hidden');
            lightboxImg.style.opacity = '0';
            setTimeout(() => { lightboxImg.style.opacity = '1'; }, 10);
        };

        img.onerror = function() {
            attempt++;
            if (attempt < tryList.length) {
                console.log('Trying alternate URL:', tryList[attempt]);
                img.src = tryList[attempt]; // Try next candidate
            } else {
                console.error('Failed to load image after all attempts:', tryList[0]);
                if (loader) loader.classList.add('hidden');
                lightboxImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23374151"/%3E%3Ctext x="200" y="150" font-family="Arial" font-size="16" fill="%23ef4444" text-anchor="middle" dominant-baseline="middle"%3EPilti ei õnnestunud laadida%3C/text%3E%3C/svg%3E';
                lightboxCaption.textContent = 'Viga: ' + (photo.caption || '');
            }
        };

        // Add transition
        lightboxImg.style.transition = 'opacity 0.3s ease';

        // Kick off loading
        img.src = tryList[attempt];

        // Update navigation visibility
        lightboxPrev.style.display = lightboxPhotos.length > 1 ? 'flex' : 'none';
        lightboxNext.style.display = lightboxPhotos.length > 1 ? 'flex' : 'none';
    }
    
    function preloadAdjacentImages(currentIndex) {
        // Preload next image
        const nextIndex = (currentIndex + 1) % lightboxPhotos.length;
        if (!lightboxPhotos[nextIndex].loaded) {
            const nextImg = new Image();
            nextImg.onload = () => { lightboxPhotos[nextIndex].loaded = true; };
            nextImg.src = lightboxPhotos[nextIndex].src;
        }
        
        // Preload previous image
        const prevIndex = currentIndex === 0 ? lightboxPhotos.length - 1 : currentIndex - 1;
        if (!lightboxPhotos[prevIndex].loaded) {
            const prevImg = new Image();
            prevImg.onload = () => { lightboxPhotos[prevIndex].loaded = true; };
            prevImg.src = lightboxPhotos[prevIndex].src;
        }
    }

    function setupImageLazyLoading() {
        const images = photoGrid.querySelectorAll('img[loading="lazy"]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.classList.add('opacity-0');
                        img.onload = () => img.classList.remove('opacity-0');
                        observer.unobserve(img);
                    }
                });
            });

            images.forEach(img => imageObserver.observe(img));
        }
    }
});