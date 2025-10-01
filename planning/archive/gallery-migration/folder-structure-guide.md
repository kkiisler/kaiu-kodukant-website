# Google Drive Gallery Folder Structure Guide

## Overview
This guide explains how to organize photos in Google Drive for the MTÜ Kaiu Kodukant gallery system.

## Root Folder Setup

### 1. Create Main Gallery Folder
```
📁 Kaiu Galerii
```
- This is your root gallery folder
- Get the folder ID from the URL when viewing it
- Example URL: `https://drive.google.com/drive/folders/1ABC123XYZ`
- Folder ID: `1ABC123XYZ`

### 2. Folder Permissions
- Share with Apps Script service account (if applicable)
- Set permission level to "Editor"
- Make sure the folder is not publicly accessible (unless intended)

## Album Folder Structure

### Basic Album Structure
```
📁 Kaiu Galerii/
├── 📁 2024-Suvefestival/
│   ├── 🖼️ festival-001.jpg
│   ├── 🖼️ festival-002.jpg
│   └── 🖼️ festival-003.jpg
├── 📁 2024-Kevadkorrastus/
│   ├── 🖼️ korrastus-001.jpg
│   └── 🖼️ korrastus-002.jpg
└── 📁 2023-Jõulupidu/
    ├── 🖼️ jõulud-001.jpg
    └── 🖼️ jõulud-002.jpg
```

### Advanced Album Structure (with metadata)
```
📁 Kaiu Galerii/
└── 📁 2024-Suvefestival/
    ├── 🖼️ cover.jpg           # Optional: Specific cover image
    ├── 📄 info.txt            # Optional: Album metadata
    ├── 🖼️ festival-001.jpg
    ├── 🖼️ festival-002.jpg
    └── 🖼️ festival-003.jpg
```

## Naming Conventions

### Album Folder Names

#### Format: `YYYY-EventName`

✅ **Good Examples:**
- `2024-Suvefestival`
- `2024-Kevadkorrastus`
- `2023-Jõulupidu`
- `2024-Küla-Koristustalgud`

❌ **Avoid:**
- `suvefestival` (missing year)
- `2024 Suve Festival` (spaces)
- `Festival_2024` (wrong order)

#### Guidelines:
1. Start with 4-digit year
2. Use dash (-) as separator
3. No spaces (use dashes instead)
4. Estonian characters (ä, ö, ü, õ) are OK
5. Keep names concise but descriptive

### Photo File Names

✅ **Good Examples:**
- `festival-001.jpg`
- `suvepäev-grupp.jpg`
- `korraldajad-2024.jpg`

❌ **Avoid:**
- `IMG_1234.jpg` (not descriptive)
- `photo 1.jpg` (has spaces)
- `DCIM0001.JPG` (camera default)

## Special Files

### 1. Cover Image (`cover.jpg`)

**Purpose:** Thumbnail for album in gallery view

**Requirements:**
- Must be named exactly `cover.jpg` (lowercase)
- Should be representative of the album
- Recommended: 800x600px or larger
- If missing, first image alphabetically is used

**Example:**
```
📁 2024-Suvefestival/
├── 🖼️ cover.jpg          ← This will be the album cover
├── 🖼️ festival-001.jpg
└── 🖼️ festival-002.jpg
```

### 2. Album Information (`info.txt`)

**Purpose:** Provide date and description for album

**Format:**
```
Line 1: Date in Estonian format
Line 2+: Optional description
```

**Example info.txt:**
```
15. juuli 2024
Traditsiooniline suvefestival toimus Kaiu keskplatsil. 
Osales üle 200 inimese. Esinesid kohalikud kollektiivid.
```

**Notes:**
- First line MUST be the date
- Use Estonian date format: `DD. month YYYY`
- Description can be multiple lines
- Use UTF-8 encoding for Estonian characters

## Image Guidelines

### Recommended Image Specifications

#### File Formats
- ✅ JPEG (.jpg, .jpeg)
- ✅ PNG (.png)
- ✅ WebP (.webp)
- ✅ GIF (.gif)
- ❌ RAW formats (convert first)
- ❌ HEIC (convert to JPEG)

#### Image Sizes
- **Minimum:** 800x600px
- **Recommended:** 1920x1080px or larger
- **Maximum:** No hard limit, but consider file size

#### File Size Optimization
- Keep under 5MB per image for faster loading
- Google Drive automatically creates optimized versions
- Original quality is preserved

### Image Organization Tips

1. **Batch Processing:**
   - Rename photos before uploading
   - Use sequential numbering (001, 002, 003)
   - Maintain consistent format

2. **Quality Control:**
   - Remove blurry or duplicate photos
   - Ensure proper orientation
   - Check for appropriate content

3. **Upload Methods:**
   - Google Drive web interface (drag & drop)
   - Google Drive desktop app
   - Google Drive mobile app
   - Google Photos sync (if configured)

## Practical Examples

### Example 1: Simple Event Album
```
📁 2024-Jaanipäev/
├── 🖼️ jaanipäev-001.jpg
├── 🖼️ jaanipäev-002.jpg
├── 🖼️ jaanipäev-003.jpg
├── 🖼️ jaanipäev-004.jpg
└── 🖼️ jaanipäev-005.jpg
```
- No metadata files needed
- First image becomes cover
- Date extracted from folder name

### Example 2: Detailed Event Album
```
📁 2024-Külapäev/
├── 🖼️ cover.jpg              # Specific cover image
├── 📄 info.txt               # Metadata file
│   └─ "10. august 2024
│       Kaiu külapäev toimus suurejooneliselt.
│       Palju põnevaid tegevusi lastele ja täiskasvanutele."
├── 🖼️ avamine-001.jpg
├── 🖼️ avamine-002.jpg
├── 🖼️ laat-001.jpg
├── 🖼️ laat-002.jpg
├── 🖼️ kontsert-001.jpg
├── 🖼️ kontsert-002.jpg
└── 🖼️ ilutulestik-001.jpg
```

### Example 3: Multi-Day Event
```
📁 2024-Festival-3-Päeva/
├── 🖼️ cover.jpg
├── 📄 info.txt
│   └─ "5.-7. juuli 2024
│       Kolmepäevane festival"
├── 🖼️ päev1-001.jpg
├── 🖼️ päev1-002.jpg
├── 🖼️ päev2-001.jpg
├── 🖼️ päev2-002.jpg
├── 🖼️ päev3-001.jpg
└── 🖼️ päev3-002.jpg
```

## Management Workflow

### Adding a New Album

1. **Create Folder:**
   - Navigate to "Kaiu Galerii" in Google Drive
   - Create new folder with format: `YYYY-EventName`

2. **Upload Photos:**
   - Select all photos for the album
   - Drag and drop into the folder
   - Or use Upload button

3. **Add Metadata (Optional):**
   - Create `info.txt` with date and description
   - Add `cover.jpg` if specific cover needed

4. **Wait for Cache:**
   - Changes appear after 30-60 minutes
   - Or ask admin to clear cache for immediate update

### Editing an Album

1. **To Add Photos:**
   - Simply upload new photos to folder

2. **To Remove Photos:**
   - Delete unwanted photos from folder

3. **To Update Description:**
   - Edit `info.txt` file

4. **To Change Cover:**
   - Replace or add `cover.jpg`

### Deleting an Album

1. Move folder to trash in Google Drive
2. Album disappears from gallery after cache expires
3. Can be restored from trash if needed

## Troubleshooting

### Album Not Appearing
- Check folder is in correct location
- Ensure folder contains at least one image
- Wait for cache to expire (30-60 min)
- Verify folder name format

### Wrong Cover Image
- Add explicit `cover.jpg` file
- Check file is named correctly (lowercase)
- Clear cache if needed

### Description Not Showing
- Check `info.txt` format
- Ensure date is on first line
- Verify UTF-8 encoding

### Photos Not Loading
- Check image format (JPEG, PNG)
- Verify file permissions
- Ensure files are images, not documents

## Best Practices

1. **Consistent Naming:**
   - Use same format for all albums
   - Keep chronological order

2. **Regular Maintenance:**
   - Review old albums periodically
   - Remove duplicate photos
   - Update descriptions as needed

3. **Backup Strategy:**
   - Keep original photos backed up
   - Document album structure
   - Export important metadata

4. **Performance:**
   - Limit albums to 50-100 photos
   - Optimize large images before upload
   - Use cover images for better loading

---

*Guide Version: 1.0*  
*For Google Drive Gallery System*  
*Last Updated: November 2024*