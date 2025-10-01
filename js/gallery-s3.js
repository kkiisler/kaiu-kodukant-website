// Gallery functionality - S3 Implementation

let galleryInitialized = false;
let currentAlbumTitle = '';
let currentAlbumDescription = '';
let lightboxPhotos = [];
let currentLightboxIndex = 0;

// S3 Configuration - use proxy endpoints from config.js
const S3_CONFIG = window.S3_CONFIG || {
    baseUrl: '',
    endpoints: {
        galleryAlbums: '/api/gallery/albums.json',
        galleryAlbum: '/api/gallery/albums/{id}.json'
    }
};

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

    async function initializeGallery() {
        if (galleryInitialized) return;
        galleryInitialized = true;

        await loadAlbums();
    }

    // Helper function to handle S3 errors with user-friendly messages
    async function fetchWithErrorHandling(url, description) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`${description} not found yet (404). This is normal for new setups.`);
                    return null;
                }
                throw new Error(`Failed to load ${description}: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error loading ${description}:`, error);

            // Show user-friendly error
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                showError('Võrguühenduse viga. Palun proovi hiljem uuesti.');
            }

            return null;
        }
    }

    // Load all albums from S3
    async function loadAlbums() {
        console.log('Loading albums from S3...');

        const url = `${S3_CONFIG.baseUrl}${S3_CONFIG.endpoints.galleryAlbums}`;
        const albumsData = await fetchWithErrorHandling(url, 'albums');

        if (!albumsData) {
            albumGrid.innerHTML = '<p class="text-gray-500">Albumeid ei leitud või toimub sünkroonimine...</p>';
            return;
        }

        console.log(`Loaded ${albumsData.albums ? albumsData.albums.length : 0} albums from S3`);
        displayAlbums(albumsData);
    }

    // Display albums in grid
    function displayAlbums(data) {
        if (!data || !data.albums || data.albums.length === 0) {
            albumGrid.innerHTML = '<p class="text-gray-500">Albumeid ei leitud.</p>';
            return;
        }

        albumGrid.innerHTML = '';

        data.albums.forEach(album => {
            const albumCard = document.createElement('div');
            albumCard.className = 'album-card';
            albumCard.onclick = () => loadAlbum(album.id, album.name);

            // Use cover photo from S3 or placeholder
            const coverImage = album.coverPhoto?.thumbnailUrl || '/api/placeholder/400/300';

            albumCard.innerHTML = `
                <div class="album-cover">
                    <img src="${coverImage}"
                         alt="${album.name}"
                         loading="lazy"
                         onerror="this.src='/api/placeholder/400/300'">
                </div>
                <div class="album-info">
                    <h3>${album.name}</h3>
                    <p>${album.photoCount || 0} fotot</p>
                </div>
            `;

            albumGrid.appendChild(albumCard);
        });
    }

    // Load specific album from S3
    async function loadAlbum(albumId, albumName) {
        console.log(`Loading album: ${albumName} (${albumId}) from S3...`);

        currentAlbumTitle = albumName;

        const url = `${S3_CONFIG.baseUrl}${S3_CONFIG.endpoints.galleryAlbum.replace('{id}', albumId)}`;
        const albumData = await fetchWithErrorHandling(url, `album ${albumName}`);

        if (!albumData) {
            photoGrid.innerHTML = '<p class="text-gray-500">Albumi laadimine ebaõnnestus.</p>';
            showPhotoView();
            return;
        }

        console.log(`Loaded ${albumData.photos ? albumData.photos.length : 0} photos for album ${albumName}`);
        displayPhotos(albumData);
        showPhotoView();
    }

    // Display photos in grid
    function displayPhotos(data) {
        if (!data || !data.photos || data.photos.length === 0) {
            photoGrid.innerHTML = '<p class="text-gray-500">Selles albumis pole veel fotosid.</p>';
            return;
        }

        // Update album title and description
        const albumTitleElement = document.getElementById('album-title');
        const albumDescriptionElement = document.getElementById('album-description');

        if (albumTitleElement) {
            albumTitleElement.textContent = data.name || currentAlbumTitle;
        }

        if (albumDescriptionElement) {
            albumDescriptionElement.textContent = data.description || `${data.photoCount || data.photos.length} fotot`;
        }

        // Clear existing photos
        photoGrid.innerHTML = '';
        lightboxPhotos = [];

        // Display photos
        data.photos.forEach((photo, index) => {
            const photoCard = document.createElement('div');
            photoCard.className = 'photo-card';
            photoCard.onclick = () => openLightbox(index);

            // Use thumbnail URL from S3
            const thumbnailUrl = photo.thumbnailUrl || photo.urls?.small || '/api/placeholder/400/300';

            photoCard.innerHTML = `
                <img src="${thumbnailUrl}"
                     alt="${photo.name || 'Foto ' + (index + 1)}"
                     loading="lazy"
                     onerror="this.src='/api/placeholder/400/300'">
                ${photo.name ? `<div class="photo-caption">${photo.name}</div>` : ''}
            `;

            photoGrid.appendChild(photoCard);

            // Store photo data for lightbox
            lightboxPhotos.push({
                src: photo.largeUrl || photo.urls?.large || photo.originalUrl || thumbnailUrl,
                caption: photo.name || '',
                thumbnail: thumbnailUrl
            });
        });
    }

    // Show photo view, hide album view
    function showPhotoView() {
        albumView.style.display = 'none';
        photoView.style.display = 'block';
        window.scrollTo(0, 0);
    }

    // Show album view, hide photo view
    function showAlbumView() {
        photoView.style.display = 'none';
        albumView.style.display = 'block';
        photoGrid.innerHTML = '';
        lightboxPhotos = [];
        window.scrollTo(0, 0);
    }

    // Back to albums button
    if (backToAlbumsButton) {
        backToAlbumsButton.addEventListener('click', showAlbumView);
    }

    // Lightbox functionality
    function openLightbox(index) {
        currentLightboxIndex = index;
        updateLightbox();
        lightbox.style.display = 'flex';
        document.body.classList.add('no-scroll');
    }

    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.classList.remove('no-scroll');
    }

    function updateLightbox() {
        const photo = lightboxPhotos[currentLightboxIndex];
        if (!photo) return;

        lightboxImg.src = photo.src;
        lightboxCaption.textContent = photo.caption || '';

        // Update navigation buttons
        lightboxPrev.style.display = currentLightboxIndex > 0 ? 'block' : 'none';
        lightboxNext.style.display = currentLightboxIndex < lightboxPhotos.length - 1 ? 'block' : 'none';
    }

    function navigateLightbox(direction) {
        if (direction === 'prev' && currentLightboxIndex > 0) {
            currentLightboxIndex--;
            updateLightbox();
        } else if (direction === 'next' && currentLightboxIndex < lightboxPhotos.length - 1) {
            currentLightboxIndex++;
            updateLightbox();
        }
    }

    // Lightbox event listeners
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => navigateLightbox('prev'));
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => navigateLightbox('next'));
    }

    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (lightbox.style.display !== 'flex') return;

            switch(e.key) {
                case 'Escape':
                    closeLightbox();
                    break;
                case 'ArrowLeft':
                    navigateLightbox('prev');
                    break;
                case 'ArrowRight':
                    navigateLightbox('next');
                    break;
            }
        });
    }

    // Show error message to user
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4';
        errorDiv.innerHTML = `
            <span class="block sm:inline">${message}</span>
            <span class="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onclick="this.parentElement.remove()">
                <svg class="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <title>Close</title>
                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
            </span>
        `;

        const container = albumView.style.display === 'none' ? photoView : albumView;
        container.insertBefore(errorDiv, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => errorDiv.remove(), 5000);
    }

    // Check data staleness
    function checkStaleness() {
        // Optional: Add visual indicator if data is stale
        // This would require checking the lastUpdated timestamp from the manifest
    }
});