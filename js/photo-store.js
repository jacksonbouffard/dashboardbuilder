/* ===========================================
   Watershed Dashboard Builder - Photo Store Module
   =========================================== */

/**
 * PhotoStore Module
 * 
 * Manages photo blobs and their Object URLs for use during the editing session.
 * Provides centralized lookup, cleanup, and access to raw blobs for export.
 * 
 * Usage:
 *   PhotoStore.load(zipFile)          // Load images from a ZIP file
 *   PhotoStore.getUrl('images/142_1.jpg')  // Get blob URL for display
 *   PhotoStore.getBlob('images/142_1.jpg') // Get raw blob for export
 *   PhotoStore.hasPhotos()            // Check if any photos are loaded
 *   PhotoStore.clear()                // Cleanup all URLs and data
 */
const PhotoStore = {
    // Map<relativePath, blobUrl>
    _urlMap: new Map(),
    
    // Map<relativePath, Blob>
    _blobMap: new Map(),
    
    // Whether photos have been loaded
    _loaded: false,
    
    /**
     * Load images from an unpacked ZIP file object
     * @param {JSZip} zip - The unpacked JSZip object
     * @returns {Promise<number>} - Number of images loaded
     */
    load: async function(zip) {
        // Clear any existing data first
        this.clear();
        
        let loadedCount = 0;
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        // Find all image files in the zip
        const imageFiles = [];
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                const lowerPath = relativePath.toLowerCase();
                if (imageExtensions.some(ext => lowerPath.endsWith(ext))) {
                    imageFiles.push({ path: relativePath, entry: zipEntry });
                }
            }
        });
        
        // Load all images in parallel
        await Promise.all(imageFiles.map(async ({ path, entry }) => {
            try {
                const blob = await entry.async('blob');
                
                // Store the blob
                this._blobMap.set(path, blob);
                
                // Create and store the object URL
                const url = URL.createObjectURL(blob);
                this._urlMap.set(path, url);
                
                loadedCount++;
            } catch (error) {
                console.warn(`Failed to load image: ${path}`, error);
            }
        }));
        
        this._loaded = loadedCount > 0;
        console.log(`PhotoStore: Loaded ${loadedCount} images`);
        
        return loadedCount;
    },
    
    /**
     * Get the blob URL for a relative path
     * @param {string} relativePath - e.g., "images/142_1.jpg"
     * @returns {string|null} - The blob URL or null if not found
     */
    getUrl: function(relativePath) {
        return this._urlMap.get(relativePath) || null;
    },
    
    /**
     * Get the raw Blob for a relative path (for export)
     * @param {string} relativePath - e.g., "images/142_1.jpg"
     * @returns {Blob|null} - The Blob or null if not found
     */
    getBlob: function(relativePath) {
        return this._blobMap.get(relativePath) || null;
    },
    
    /**
     * Check if photos have been loaded
     * @returns {boolean}
     */
    hasPhotos: function() {
        return this._loaded && this._urlMap.size > 0;
    },
    
    /**
     * Get all loaded image paths
     * @returns {string[]}
     */
    getAllPaths: function() {
        return Array.from(this._urlMap.keys());
    },
    
    /**
     * Get the count of loaded photos
     * @returns {number}
     */
    getCount: function() {
        return this._urlMap.size;
    },
    
    /**
     * Parse the photos property from a GeoJSON feature
     * Returns an array of relative paths, or empty array if none/invalid
     * @param {Object} properties - Feature properties object
     * @returns {string[]}
     */
    parsePhotosProperty: function(properties) {
        if (!properties) {
            return [];
        }
        
        // Check for both lowercase 'photos' and capitalized 'Photos' (field mapping)
        const photosValue = properties.photos || properties.Photos;
        
        if (!photosValue) {
            return [];
        }
        
        // If it's already an array
        if (Array.isArray(photosValue)) {
            return photosValue.filter(p => typeof p === 'string' && p.length > 0);
        }
        
        // If it's null or empty string
        if (photosValue === null || photosValue === '') {
            return [];
        }
        
        // If it's a JSON string, try to parse it
        if (typeof photosValue === 'string') {
            try {
                const parsed = JSON.parse(photosValue);
                if (Array.isArray(parsed)) {
                    return parsed.filter(p => typeof p === 'string' && p.length > 0);
                }
            } catch (e) {
                // Not valid JSON - could be a single path?
                // Just return it as a single-item array if it looks like a path
                if (photosValue.includes('/') || photosValue.includes('.')) {
                    return [photosValue];
                }
            }
        }
        
        return [];
    },
    
    /**
     * Resolve photo paths to blob URLs for a feature
     * Returns array of {path, url} objects for photos that exist in the store
     * @param {Object} properties - Feature properties object
     * @returns {{path: string, url: string}[]}
     */
    resolvePhotos: function(properties) {
        const paths = this.parsePhotosProperty(properties);
        const resolved = [];
        
        for (const path of paths) {
            const url = this.getUrl(path);
            if (url) {
                resolved.push({ path, url });
            }
        }
        
        return resolved;
    },
    
    /**
     * Clear all stored data and revoke object URLs
     */
    clear: function() {
        // Revoke all object URLs to free memory
        for (const url of this._urlMap.values()) {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        
        this._urlMap.clear();
        this._blobMap.clear();
        this._loaded = false;
        
        console.log('PhotoStore: Cleared all data');
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PhotoStore = PhotoStore;
}
