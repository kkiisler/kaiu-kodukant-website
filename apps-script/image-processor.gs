/**
 * Image Processing for Gallery Sync
 * Downloads images from Drive and uploads to S3
 * Note: Apps Script cannot resize images, so we use Drive's thumbnail API
 */

/**
 * Process and upload a photo to S3 with multiple sizes
 * Uses Google Drive's thumbnail generation service
 */
function processPhotoToS3(photo, album) {
  const photoId = photo.id;

  try {
    // Google Drive provides thumbnails via URL parameters
    // We'll fetch these and upload to S3
    const sizes = [
      { name: 'small', width: 300 },
      { name: 'medium', width: 600 },
      { name: 'large', width: 1200 }
    ];

    for (const size of sizes) {
      try {
        // Get thumbnail from Google Drive
        const thumbnailUrl = `https://drive.google.com/thumbnail?id=${photoId}&sz=w${size.width}`;
        const response = UrlFetchApp.fetch(thumbnailUrl, {
          muteHttpExceptions: true,
          headers: {
            'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
          }
        });

        if (response.getResponseCode() === 200) {
          // Get the image blob
          const imageBlob = response.getBlob();

          // Generate S3 key
          const s3Key = `images/${photoId}-${size.width}.jpg`;

          // Upload to S3
          uploadToS3(s3Key, imageBlob, 'image/jpeg', true);

          Logger.log(`✓ Uploaded ${size.name} image: ${s3Key}`);

          // Update photo object with S3 URLs
          photo[`${size.name}S3Url`] = `https://s3.pilw.io/kaiugalerii/${s3Key}`;
        } else {
          Logger.log(`Failed to get ${size.name} thumbnail for ${photo.name}: ${response.getResponseCode()}`);
        }
      } catch (error) {
        Logger.log(`Error processing ${size.name} size for ${photo.name}: ${error.message}`);
      }
    }

    // Also upload original (full resolution)
    try {
      const file = DriveApp.getFileById(photoId);
      const originalBlob = file.getBlob();
      const s3Key = `images/${photoId}-original.${getFileExtension(file.getMimeType())}`;

      // Only upload if file is reasonable size (< 10MB)
      if (originalBlob.getBytes().length < 10 * 1024 * 1024) {
        uploadToS3(s3Key, originalBlob, file.getMimeType(), true);
        photo.originalS3Url = `https://s3.pilw.io/kaiugalerii/${s3Key}`;
        Logger.log(`✓ Uploaded original image: ${s3Key}`);
      } else {
        Logger.log(`Skipping original upload for ${photo.name} - too large (${Math.round(originalBlob.getBytes().length / 1024 / 1024)}MB)`);
        photo.originalS3Url = photo.originalUrl; // Keep Drive URL
      }
    } catch (error) {
      Logger.log(`Error uploading original for ${photo.name}: ${error.message}`);
      photo.originalS3Url = photo.originalUrl; // Fallback to Drive URL
    }

    return photo;

  } catch (error) {
    Logger.log(`Failed to process photo ${photo.name}: ${error.message}`);
    throw error;
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp'
  };
  return extensions[mimeType] || 'jpg';
}

/**
 * Process a batch of photos with progress tracking
 * This is called from gallery-sync.gs
 */
function processBatchOfPhotos(photos, startIndex, batchSize, album) {
  const endIndex = Math.min(startIndex + batchSize, photos.length);
  const processed = [];

  for (let i = startIndex; i < endIndex; i++) {
    const photo = photos[i];

    try {
      // Process and upload to S3
      const processedPhoto = processPhotoToS3(photo, album);
      processed.push(processedPhoto);

      // Log progress every 5 photos
      if ((i - startIndex + 1) % 5 === 0) {
        Logger.log(`Progress: ${i - startIndex + 1}/${batchSize} photos processed in this batch`);
      }
    } catch (error) {
      Logger.log(`Error processing photo ${i}: ${error.message}`);
      // Add photo with Drive URLs as fallback
      processed.push(photo);
    }
  }

  return processed;
}

/**
 * Check if image already exists in S3
 * This can help avoid re-uploading
 */
function imageExistsInS3(key) {
  try {
    // Try to get metadata for the object
    const url = `https://s3.pilw.io/kaiugalerii/${key}`;
    const response = UrlFetchApp.fetch(url, {
      method: 'HEAD',
      muteHttpExceptions: true
    });

    return response.getResponseCode() === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Upload photo metadata after processing
 * This updates the photo object with S3 URLs
 */
function updatePhotoMetadata(photo, album) {
  // Build the final photo object
  const photoMetadata = {
    id: photo.id,
    name: photo.name,
    albumId: album.id,
    albumName: album.name,
    created: photo.created,

    // S3 URLs (if processed) or Drive URLs (as fallback)
    thumbnailUrl: photo.smallS3Url || photo.thumbnailUrl,
    mediumUrl: photo.mediumS3Url || photo.mediumUrl,
    largeUrl: photo.largeS3Url || photo.largeUrl,
    originalUrl: photo.originalS3Url || photo.originalUrl,

    // Track which URLs are from S3
    urls: {
      small: photo.smallS3Url || null,
      medium: photo.mediumS3Url || null,
      large: photo.largeS3Url || null,
      original: photo.originalS3Url || null
    },

    processedAt: new Date().toISOString()
  };

  return photoMetadata;
}