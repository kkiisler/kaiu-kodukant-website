// Gallery functionality

let galleryInitialized = false;
let currentAlbumTitle = '';
let currentAlbumDescription = '';
let lightboxPhotos = [];
let currentLightboxIndex = 0;

// Configuration
const S3_BASE_URL = 'https://s3.pilw.io/kaiugalerii/';

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

    async function initializeGallery() {
        if (galleryInitialized) return;
        galleryInitialized = true;
        
        albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galeriide laadimine...</p>';
        
        try {
            // Fetch albums from S3 XML
            const response = await fetch(S3_BASE_URL + 'albums.xml');
            if (!response.ok) throw new Error('Failed to load albums');
            
            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            
            const albums = Array.from(xml.querySelectorAll('album')).map(album => ({
                id: album.querySelector('id').textContent,
                title: album.querySelector('title').textContent,
                date: album.querySelector('date').textContent,
                description: album.querySelector('description')?.textContent || '',
                coverImageUrl: S3_BASE_URL + album.querySelector('coverImage').textContent,
                imageCount: parseInt(album.querySelector('imageCount').textContent)
            }));
            
            displayAlbums(albums);
        } catch (error) {
            console.error('Error loading gallery:', error);
            loadExampleGalleryData();
        }
    }

    function displayAlbums(albums) {
        albumGrid.innerHTML = '';
        
        if (albums.length === 0) {
            albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galeriis pole veel albumeid.</p>';
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
            albumEl.addEventListener('click', () => loadAlbum(album.id, album.title, album.description));
            albumGrid.appendChild(albumEl);
        });
    }

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
            // Fetch photos from S3 XML
            const response = await fetch(S3_BASE_URL + albumId + '/photos.xml');
            if (!response.ok) throw new Error('Failed to load photos');
            
            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            
            const photos = Array.from(xml.querySelectorAll('photo')).map(photo => ({
                id: photo.querySelector('id').textContent,
                name: photo.querySelector('name').textContent,
                url: S3_BASE_URL + albumId + '/' + photo.querySelector('url').textContent,
                thumbnailUrl: S3_BASE_URL + albumId + '/thumbs/' + photo.querySelector('thumbnail').textContent,
                caption: photo.querySelector('caption')?.textContent || ''
            }));
            
            displayAlbumPhotos(photos);
        } catch (error) {
            console.error('Error loading album:', error);
            loadExampleAlbumData(albumId, title, description);
        }
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

    function loadExampleGalleryData() {
        const exampleAlbums = [
            {
                id: 'example1',
                title: 'Suvefestival 2024 (Näidis)',
                date: '15. juuli 2024',
                description: 'Traditsioonilne suvefestival kogu perele',
                coverImageUrl: 'https://placehold.co/600x400/cfcabe/111111?text=Suvefestival',
                imageCount: 8
            },
            {
                id: 'example2',
                title: 'Kevadkorrastus 2024 (Näidis)',
                date: '20. aprill 2024',
                description: 'Kogukonna ühine kevadkorrastus',
                coverImageUrl: 'https://placehold.co/600x400/cfcabe/111111?text=Kevadkorrastus',
                imageCount: 12
            }
        ];
        albumGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Galerii backend pole veel seadistatud. Näidisgalerii:</p>';
        setTimeout(() => displayAlbums(exampleAlbums), 500);
    }
    
    function loadExampleAlbumData(albumId, title, description) {
        currentAlbumTitle = title;
        currentAlbumDescription = description;
        
        const examplePhotos = [
            {
                id: 'ex1',
                name: 'pilt1.jpg',
                url: 'https://placehold.co/800x600/cfcabe/111111?text=Näidispilt+1',
                thumbnailUrl: 'https://placehold.co/400x300/cfcabe/111111?text=Näidispilt+1',
                caption: 'Näidispilt 1'
            },
            {
                id: 'ex2',
                name: 'pilt2.jpg',
                url: 'https://placehold.co/800x600/cfcabe/111111?text=Näidispilt+2',
                thumbnailUrl: 'https://placehold.co/400x300/cfcabe/111111?text=Näidispilt+2',
                caption: 'Näidispilt 2'
            },
            {
                id: 'ex3',
                name: 'pilt3.jpg',
                url: 'https://placehold.co/800x600/cfcabe/111111?text=Näidispilt+3',
                thumbnailUrl: 'https://placehold.co/400x300/cfcabe/111111?text=Näidispilt+3',
                caption: 'Näidispilt 3'
            },
            {
                id: 'ex4',
                name: 'pilt4.jpg',
                url: 'https://placehold.co/800x600/cfcabe/111111?text=Näidispilt+4',
                thumbnailUrl: 'https://placehold.co/400x300/cfcabe/111111?text=Näidispilt+4',
                caption: 'Näidispilt 4'
            }
        ];
        displayAlbumPhotos(examplePhotos);
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