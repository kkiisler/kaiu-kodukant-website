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
            photoView.classList.add('hidden');
            albumView.classList.remove('hidden');
        });
    }

    // Lightbox controls
    if (lightboxClose) {
        lightboxClose.addEventListener('click', () => {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
        });
    }

    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => {
            currentLightboxIndex = (currentLightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
            updateLightboxContent();
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => {
            currentLightboxIndex = (currentLightboxIndex + 1) % lightboxPhotos.length;
            updateLightboxContent();
        });
    }

    // Close lightbox on background click
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                lightbox.classList.add('hidden');
                lightbox.classList.remove('flex');
            }
        });
    }

    // Keyboard navigation for lightbox
    document.addEventListener('keydown', (e) => {
        if (!lightbox || lightbox.classList.contains('hidden')) return;
        
        if (e.key === 'Escape') {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
        } else if (e.key === 'ArrowLeft') {
            lightboxPrev.click();
        } else if (e.key === 'ArrowRight') {
            lightboxNext.click();
        }
    });

    function initializeGallery() {
        if (galleryInitialized) return;
        galleryInitialized = true;
        
        albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galeriide laadimine...</p>';
        
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=gallery`;
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
                albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Viga galerii laadimisel. Palun proovi hiljem uuesti.</p>';
            }
        }, function(error) {
            console.error('Error loading gallery:', error);
            albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Viga galerii laadimisel. Palun proovi hiljem uuesti.</p>';
        });
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
            albumEl.innerHTML = `
                <div class="overflow-hidden aspect-square bg-gray-200">
                    <img src="${album.coverImageUrl}" alt="${album.title}" 
                         class="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                         loading="lazy">
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
            albumEl.addEventListener('click', () => loadAlbum(album.id, album.title, album.description || ''));
            albumGrid.appendChild(albumEl);
        });
    }

    function loadAlbum(albumId, title, description) {
        albumView.classList.add('hidden');
        photoView.classList.remove('hidden');
        window.scrollTo(0, 0);
        photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Piltide laadimine...</p>';
        
        currentAlbumTitle = title;
        currentAlbumDescription = description;
        
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=album&id=${encodeURIComponent(albumId)}`;
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
            lightboxPhotos.push({ 
                src: photo.url, 
                caption: photo.caption || photo.name
            });

            const photoEl = document.createElement('div');
            photoEl.className = 'photo-thumbnail cursor-pointer overflow-hidden rounded-lg aspect-square bg-gray-200 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300';
            photoEl.innerHTML = `
                <img src="${photo.thumbnailUrl}" alt="${photo.caption || photo.name}" 
                     loading="lazy" 
                     class="object-cover w-full h-full"
                     data-full-url="${photo.url}">
            `;
            photoEl.addEventListener('click', () => openLightbox(index));
            photoGrid.appendChild(photoEl);
        });
        
        setupImageLazyLoading();
    }

    function openLightbox(index) {
        currentLightboxIndex = index;
        updateLightboxContent();
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
    }

    function updateLightboxContent() {
        const photo = lightboxPhotos[currentLightboxIndex];
        
        lightboxImg.style.opacity = '0.5';
        lightboxImg.src = photo.src;
        lightboxCaption.textContent = photo.caption || '';
        
        lightboxImg.onload = function() {
            lightboxImg.style.opacity = '1';
        };
    }
    
    function setupImageLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const fullUrl = img.getAttribute('data-full-url');
                        
                        if (fullUrl && fullUrl !== img.src) {
                            const fullImg = new Image();
                            fullImg.src = fullUrl;
                        }
                        
                        imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '100px 0px',
                threshold: 0.1
            });
            
            document.querySelectorAll('img[data-full-url]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
});