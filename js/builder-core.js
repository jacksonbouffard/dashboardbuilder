/* ===========================================
   Watershed Dashboard Builder - Core Module
   =========================================== */

/**
 * Builder State Management
 */
const BuilderState = {
    // Uploaded data
    projectsData: null,
    streamsData: null,
    watershedData: null,
    municipalityData: null,
    parcelData: null,
    
    // Parcel service links
    parcelLinks: [],
    
    // Field mappings
    fieldMappings: {
        Project_Type: '',
        Landowner: '',
        Address: '',
        Project_Description: '',
        Notes: '',
        Municipality: '',
        Watershed_Name: ''
    },
    
    // Dashboard configuration
    dashboardConfig: {
        title: 'Watershed Dashboard',
        description: ''
    },
    
    // Symbology settings
    symbology: {
        watershed: {
            strokeColor: '#0056b3',
            strokeWidth: 3,
            fillColor: 'rgba(0, 86, 179, 0.1)',
            lineDash: 'solid'
        },
        streams: {
            mode: 'plain', // 'plain' or 'byField'
            strokeColor: '#5a9fd4',
            strokeWidth: 2,
            lineDash: 'solid',
            colorField: null,
            colorMap: {}
        },
        municipalities: {
            strokeColor: '#666666',
            strokeWidth: 1.5,
            fillColor: 'rgba(200, 200, 200, 0.1)',
            lineDash: 'dashed'
        },
        parcels: {
            strokeColor: '#8B4513',
            strokeWidth: 1,
            fillColor: 'rgba(222, 184, 135, 0.15)',
            lineDash: 'solid'
        },
        points: {
            mode: 'plain', // 'plain' or 'byField'
            plainColor: '#5a9fd4',
            colorField: null, // Will be auto-detected from actual data fields
            strokeColor: '#333333',
            strokeWidth: 1.5,
            radius: 6,
            colorMap: {} // Dynamic color map for field values
        }
    },
    
    // Available fields from projects data
    availableFields: [],
    
    // Reset state
    reset: function() {
        this.projectsData = null;
        this.streamsData = null;
        this.watershedData = null;
        this.municipalityData = null;
        this.parcelData = null;
        this.parcelLinks = [];
        this.availableFields = [];
        this.fieldMappings = {
            Project_Type: '',
            Landowner: '',
            Address: '',
            Project_Description: '',
            Notes: '',
            Municipality: '',
            Watershed_Name: ''
        };
        this.dashboardConfig = {
            title: 'Watershed Dashboard',
            description: ''
        };
        this.symbology = {
            watershed: {
                strokeColor: '#0056b3',
                strokeWidth: 3,
                fillColor: 'rgba(0, 86, 179, 0.1)',
                lineDash: 'solid'
            },
            streams: {
                mode: 'plain',
                strokeColor: '#5a9fd4',
                strokeWidth: 2,
                lineDash: 'solid',
                colorField: null,
                colorMap: {}
            },
            municipalities: {
                strokeColor: '#666666',
                strokeWidth: 1.5,
                fillColor: 'rgba(200, 200, 200, 0.1)',
                lineDash: 'dashed'
            },
            parcels: {
                strokeColor: '#8B4513',
                strokeWidth: 1,
                fillColor: 'rgba(222, 184, 135, 0.15)',
                lineDash: 'solid'
            },
            points: {
                mode: 'plain',
                plainColor: '#5a9fd4',
                colorField: null, // Will be auto-detected from actual data fields
                strokeColor: '#333333',
                strokeWidth: 1.5,
                radius: 6,
                colorMap: {}
            }
        };
    },
    
    // Check if all required files are loaded
    isComplete: function() {
        return this.projectsData !== null && 
               this.streamsData !== null && 
               this.watershedData !== null;
    }
};

/**
 * Initialize the builder
 */
document.addEventListener('DOMContentLoaded', function() {
    initFileUploadHandlers();
    initActionButtons();
    initConfigInputs();
    initSymbologyEditor();
    initParcelLinksHandlers();
});

/**
 * Initialize file upload handlers
 */
function initFileUploadHandlers() {
    // Projects file
    document.getElementById('projects-file').addEventListener('change', function(e) {
        handleFileUpload(e.target.files[0], 'projects', function(data) {
            BuilderState.projectsData = data;
            updateFieldMappingOptions(data);
            showFieldMappingSection();
        });
    });
    
    // Watershed file - also triggers stream and municipality fetching
    document.getElementById('watershed-file').addEventListener('change', function(e) {
        handleFileUpload(e.target.files[0], 'watershed', function(data) {
            BuilderState.watershedData = data;
            // Auto-fetch streams and municipalities after watershed is loaded
            fetchStreamsFromDEP(data);
            fetchMunicipalitiesFromPennDOT(data);
            // Update parcel fetch button state
            updateParcelFetchButtonState();
        });
    });
}

/**
 * Handle file upload and validation
 */
function handleFileUpload(file, type, onSuccess) {
    if (!file) return;
    
    const uploadBox = document.getElementById(`${type}-upload-box`);
    const statusEl = document.getElementById(`${type}-status`);
    
    // Reset status
    uploadBox.classList.remove('loaded', 'error', 'loading');
    uploadBox.classList.add('loading');
    statusEl.className = 'file-status loading';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const data = JSON.parse(content);
            
            // Validate GeoJSON
            if (!isValidGeoJSON(data, type)) {
                throw new Error(`Invalid GeoJSON format for ${type}`);
            }
            
            // Success
            uploadBox.classList.remove('loading');
            uploadBox.classList.add('loaded');
            statusEl.className = 'file-status success';
            statusEl.innerHTML = `<i class="fas fa-check"></i> Loaded ${data.features.length} features`;
            
            // Callback with data
            if (onSuccess) onSuccess(data);
            
            // Check if all files are loaded
            checkAllFilesLoaded();
            
        } catch (error) {
            uploadBox.classList.remove('loading');
            uploadBox.classList.add('error');
            statusEl.className = 'file-status error';
            statusEl.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
            console.error('File upload error:', error);
        }
    };
    
    reader.onerror = function() {
        uploadBox.classList.remove('loading');
        uploadBox.classList.add('error');
        statusEl.className = 'file-status error';
        statusEl.innerHTML = '<i class="fas fa-times"></i> Error reading file';
    };
    
    reader.readAsText(file);
}

/**
 * Validate GeoJSON structure
 */
function isValidGeoJSON(data, type) {
    if (!data || typeof data !== 'object') return false;
    if (data.type !== 'FeatureCollection') return false;
    if (!Array.isArray(data.features)) return false;
    if (data.features.length === 0) return false;
    
    // Check geometry types
    const firstFeature = data.features[0];
    if (!firstFeature.geometry || !firstFeature.geometry.type) return false;
    
    const geomType = firstFeature.geometry.type;
    
    switch(type) {
        case 'projects':
            // Should be points
            if (!['Point', 'MultiPoint'].includes(geomType)) {
                console.warn('Project points should be Point geometry');
            }
            break;
        case 'streams':
            // Should be lines
            if (!['LineString', 'MultiLineString'].includes(geomType)) {
                console.warn('Streams should be LineString geometry');
            }
            break;
        case 'watershed':
            // Should be polygons
            if (!['Polygon', 'MultiPolygon'].includes(geomType)) {
                console.warn('Watershed boundary should be Polygon geometry');
            }
            break;
    }
    
    return true;
}

/**
 * Update field mapping dropdowns based on available fields
 */
function updateFieldMappingOptions(data) {
    if (!data || !data.features || data.features.length === 0) return;
    
    // Collect all unique field names
    const fields = new Set();
    data.features.forEach(feature => {
        if (feature.properties) {
            Object.keys(feature.properties).forEach(key => fields.add(key));
        }
    });
    
    BuilderState.availableFields = Array.from(fields).sort();
    
    // Populate dropdowns
    const mappingFields = [
        { id: 'map-project-type', target: 'Project_Type', hints: ['project_type', 'type', 'bmp_type', 'project_types'] },
        { id: 'map-landowner', target: 'Landowner', hints: ['landowner', 'owner', 'landowner_parcel'] },
        { id: 'map-address', target: 'Address', hints: ['address', 'address_parcel', 'location'] },
        { id: 'map-description', target: 'Project_Description', hints: ['project_description', 'description', 'desc'] },
        { id: 'map-notes', target: 'Notes', hints: ['notes', 'note', 'comments', 'other'] },
        { id: 'map-municipality', target: 'Municipality', hints: ['municipality', 'muni', 'town', 'township'] },
        { id: 'map-watershed-name', target: 'Watershed_Name', hints: ['watershed_name', 'watershed', 'huc12_name', 'name'] }
    ];
    
    mappingFields.forEach(mapping => {
        const select = document.getElementById(mapping.id);
        if (!select) return;
        
        // Clear existing options
        select.innerHTML = '<option value="">(Not Mapped)</option>';
        
        // Add field options
        BuilderState.availableFields.forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            select.appendChild(option);
        });
        
        // Try to auto-match fields
        const matchedField = autoMatchField(BuilderState.availableFields, mapping.hints);
        if (matchedField) {
            select.value = matchedField;
            BuilderState.fieldMappings[mapping.target] = matchedField;
        }
        
        // Add change handler
        select.addEventListener('change', function() {
            BuilderState.fieldMappings[mapping.target] = this.value;
        });
    });
    
    // Initialize color field for points symbology early
    initPointsColorField(data);
}

/**
 * Initialize points color field and generate colorMap early (before preview)
 * This ensures map styling and legend are in sync
 */
function initPointsColorField(data) {
    if (!data || !data.features || !data.features.length) return;
    
    // Find the best color field from available fields
    const colorFieldHints = ['project_type', 'projecttype', 'type', 'bmp_type', 'category', 'class'];
    let matchedField = autoMatchField(BuilderState.availableFields, colorFieldHints);
    
    // If no match found, use the first field that has reasonable unique values
    if (!matchedField && BuilderState.availableFields.length > 0) {
        // Find a field with a reasonable number of unique values (2-30)
        for (const field of BuilderState.availableFields) {
            const uniqueValues = new Set();
            data.features.forEach(f => {
                if (f.properties && f.properties[field] !== undefined && f.properties[field] !== null) {
                    uniqueValues.add(f.properties[field]);
                }
            });
            if (uniqueValues.size >= 2 && uniqueValues.size <= 30) {
                matchedField = field;
                break;
            }
        }
    }
    
    // Default to first field if still not found
    if (!matchedField && BuilderState.availableFields.length > 0) {
        matchedField = BuilderState.availableFields[0];
    }
    
    if (matchedField) {
        BuilderState.symbology.points.colorField = matchedField;
        
        // Generate colorMap now so it's ready for preview
        generateColorMapForField(data, matchedField);
    }
}

/**
 * Generate color map for a specific field (used during data load)
 */
function generateColorMapForField(data, field) {
    if (!data || !data.features || !field) return;
    
    // Get unique values and counts
    const valueCounts = {};
    data.features.forEach(feature => {
        // Get the value - handle null, undefined, and empty strings
        let value = feature.properties[field];
        if (value === null || value === undefined || value === '') {
            value = 'Unknown';
        } else {
            value = String(value); // Ensure it's a string
        }
        valueCounts[value] = (valueCounts[value] || 0) + 1;
    });
    
    // Sort by count
    const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
    
    // Check for too many unique values
    if (sortedValues.length > 30) {
        BuilderState.symbology.points.colorMap = {};
        return;
    }
    
    // Generate colors
    BuilderState.symbology.points.colorMap = {};
    sortedValues.forEach(([value, count], index) => {
        const color = generateColorForValue(value, index, sortedValues.length);
        BuilderState.symbology.points.colorMap[value] = color;
    });
}

/**
 * Auto-match fields based on hints
 */
function autoMatchField(fields, hints) {
    const lowerFields = fields.map(f => f.toLowerCase());
    
    for (const hint of hints) {
        const index = lowerFields.indexOf(hint.toLowerCase());
        if (index !== -1) {
            return fields[index];
        }
    }
    
    // Partial match
    for (const hint of hints) {
        for (let i = 0; i < fields.length; i++) {
            if (lowerFields[i].includes(hint.toLowerCase())) {
                return fields[i];
            }
        }
    }
    
    return null;
}

/**
 * Show field mapping section
 */
function showFieldMappingSection() {
    const section = document.getElementById('field-mapping-section');
    if (section) {
        section.style.display = 'block';
    }
}

/**
 * Check if all files are loaded and enable preview
 */
function checkAllFilesLoaded() {
    const previewBtn = document.getElementById('preview-btn');
    
    if (BuilderState.isComplete()) {
        previewBtn.disabled = false;
        
        // Show config section
        const configSection = document.getElementById('dashboard-config-section');
        if (configSection) {
            configSection.style.display = 'block';
        }
    } else {
        previewBtn.disabled = true;
    }
}

/**
 * Initialize action buttons
 */
function initActionButtons() {
    // Preview button
    document.getElementById('preview-btn').addEventListener('click', function() {
        if (!BuilderState.isComplete()) {
            alert('Please upload all required files first.');
            return;
        }
        
        // Update config from inputs
        BuilderState.dashboardConfig.title = document.getElementById('dashboard-title').value || 'Watershed Dashboard';
        BuilderState.dashboardConfig.description = document.getElementById('dashboard-description').value || '';
        
        // Transform data based on field mappings
        transformProjectData();
        
        // Switch to preview mode
        switchToPreview();
    });
    
    // Clear button
    document.getElementById('clear-btn').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all uploaded files?')) {
            clearAllUploads();
        }
    });
    
    // Back button
    document.getElementById('back-btn').addEventListener('click', function() {
        switchToUpload();
    });
}

/**
 * Initialize config inputs
 */
function initConfigInputs() {
    const titleInput = document.getElementById('dashboard-title');
    const descInput = document.getElementById('dashboard-description');
    
    if (titleInput) {
        titleInput.addEventListener('input', function() {
            BuilderState.dashboardConfig.title = this.value;
        });
    }
    
    if (descInput) {
        descInput.addEventListener('input', function() {
            BuilderState.dashboardConfig.description = this.value;
        });
    }
}

/**
 * Transform project data to use standardized fields
 */
function transformProjectData() {
    if (!BuilderState.projectsData) return;
    
    const mappings = BuilderState.fieldMappings;
    
    BuilderState.projectsData.features = BuilderState.projectsData.features.map(feature => {
        const newProperties = {};
        
        // Map fields
        for (const [targetField, sourceField] of Object.entries(mappings)) {
            if (sourceField && feature.properties && feature.properties[sourceField] !== undefined) {
                newProperties[targetField] = feature.properties[sourceField];
            } else {
                newProperties[targetField] = '';
            }
        }
        
        return {
            type: 'Feature',
            geometry: feature.geometry,
            properties: newProperties
        };
    });
    
    // Update availableFields to use the mapped field names
    BuilderState.availableFields = Object.keys(BuilderState.fieldMappings).filter(
        field => BuilderState.fieldMappings[field] !== ''
    ).sort();
    
    console.log('Transformed fields:', BuilderState.availableFields);
}

/**
 * Clear all uploads and reset state
 */
function clearAllUploads() {
    BuilderState.reset();
    
    // Reset file inputs
    ['projects-file', 'watershed-file'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    // Reset upload boxes
    ['projects', 'watershed'].forEach(type => {
        const box = document.getElementById(`${type}-upload-box`);
        const status = document.getElementById(`${type}-status`);
        if (box) box.classList.remove('loaded', 'error', 'loading');
        if (status) {
            status.className = 'file-status';
            status.textContent = '';
        }
    });
    
    // Reset streams status
    const streamsStatus = document.getElementById('streams-status');
    if (streamsStatus) {
        streamsStatus.className = 'file-status';
        streamsStatus.textContent = 'Waiting for watershed boundary...';
    }
    
    // Reset municipalities status
    const municipalitiesBox = document.getElementById('municipalities-upload-box');
    const municipalitiesStatus = document.getElementById('municipalities-status');
    if (municipalitiesBox) municipalitiesBox.classList.remove('loaded', 'error', 'loading');
    if (municipalitiesStatus) {
        municipalitiesStatus.className = 'file-status';
        municipalitiesStatus.textContent = 'Will be fetched after watershed is uploaded';
    }
    
    // Reset parcel inputs and status
    for (let i = 1; i <= 3; i++) {
        const input = document.getElementById(`parcel-link-${i}`);
        if (input) input.value = '';
    }
    const parcelsBox = document.getElementById('parcels-upload-box');
    const parcelsStatus = document.getElementById('parcels-status');
    if (parcelsBox) parcelsBox.classList.remove('loaded', 'error', 'loading');
    if (parcelsStatus) {
        parcelsStatus.className = 'file-status';
        parcelsStatus.textContent = 'Enter at least one parcel service URL and upload watershed first';
    }
    const fetchParcelsBtn = document.getElementById('fetch-parcels-btn');
    if (fetchParcelsBtn) fetchParcelsBtn.disabled = true;
    
    // Hide parcel symbology group
    const parcelSymbologyGroup = document.getElementById('parcels-symbology-group');
    if (parcelSymbologyGroup) parcelSymbologyGroup.style.display = 'none';
    
    // Hide sections
    document.getElementById('field-mapping-section').style.display = 'none';
    document.getElementById('dashboard-config-section').style.display = 'none';
    
    // Reset config inputs
    document.getElementById('dashboard-title').value = '';
    document.getElementById('dashboard-description').value = '';
    
    // Disable preview button
    document.getElementById('preview-btn').disabled = true;
}

/**
 * Switch to preview mode
 */
function switchToPreview() {
    document.getElementById('upload-screen').style.display = 'none';
    document.getElementById('preview-screen').style.display = 'block';
    document.getElementById('preview-screen').classList.add('active');
    document.body.classList.add('preview-active');
    
    // Initialize the preview map
    if (typeof PreviewMode !== 'undefined') {
        PreviewMode.init();
    }
}

/**
 * Switch back to upload screen
 */
function switchToUpload() {
    document.getElementById('preview-screen').style.display = 'none';
    document.getElementById('preview-screen').classList.remove('active');
    document.body.classList.remove('preview-active');
    document.getElementById('upload-screen').style.display = 'flex';
    
    // Cleanup preview map
    if (typeof PreviewMode !== 'undefined') {
        PreviewMode.cleanup();
    }
}

/**
 * Get unique values from a field in the projects data
 */
function getUniqueFieldValues(fieldName) {
    if (!BuilderState.projectsData || !BuilderState.projectsData.features) return [];
    
    const values = new Set();
    BuilderState.projectsData.features.forEach(feature => {
        const val = feature.properties[fieldName];
        if (val && val !== '') {
            values.add(val);
        }
    });
    
    return Array.from(values).sort();
}

/**
 * Fetch streams from PA DEP REST service and clip to watershed boundary
 */
async function fetchStreamsFromDEP(watershedData) {
    const streamsBox = document.getElementById('streams-upload-box');
    const statusEl = document.getElementById('streams-status');
    
    // Show loading state
    if (streamsBox) {
        streamsBox.classList.remove('loaded', 'error');
        streamsBox.classList.add('loading');
    }
    if (statusEl) {
        statusEl.className = 'file-status loading';
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching streams from PA DEP...';
    }
    
    try {
        // Get bounding box from watershed
        const bbox = getBoundingBox(watershedData);
        
        // Build query URL - PA DEP IR 2026 Streams Layer
        const baseUrl = 'https://gis.dep.pa.gov/depgisprd/rest/services/BureauOfCleanWater/IR_2026_DATA/FeatureServer/1/query';
        const params = new URLSearchParams({
            where: '1=1',
            geometry: JSON.stringify({
                xmin: bbox[0],
                ymin: bbox[1],
                xmax: bbox[2],
                ymax: bbox[3],
                spatialReference: { wkid: 4326 }
            }),
            geometryType: 'esriGeometryEnvelope',
            spatialRel: 'esriSpatialRelIntersects',
            outFields: '*',
            f: 'geojson',
            outSR: 4326
        });
        
        const response = await fetch(`${baseUrl}?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const streamsData = await response.json();
        
        if (!streamsData.features || streamsData.features.length === 0) {
            throw new Error('No streams found in watershed area');
        }
        
        // Remove duplicate geometries based on ATTAINS_ID field
        // Prioritize features with "Aquatic Life" in ASSESSED_USE_CATEGORY
        // If no "Aquatic Life" version exists, keep any available version for complete geometry
        const attainsIdMap = new Map(); // Map of ATTAINS_ID -> best feature
        const featuresWithoutId = [];
        
        streamsData.features.forEach(feature => {
            const attainsId = feature.properties?.ATTAINS_ID;
            const useCategory = feature.properties?.ASSESSED_USE_CATEGORY || '';
            const isAquaticLife = useCategory === 'Aquatic Life';
            
            if (!attainsId) {
                // Keep features without ATTAINS_ID
                featuresWithoutId.push(feature);
                return;
            }
            
            if (!attainsIdMap.has(attainsId)) {
                // First time seeing this ATTAINS_ID, store it
                attainsIdMap.set(attainsId, { feature, isAquaticLife });
            } else {
                // Already have this ATTAINS_ID - check if we should replace
                const existing = attainsIdMap.get(attainsId);
                if (isAquaticLife && !existing.isAquaticLife) {
                    // Current feature is Aquatic Life, existing is not - replace
                    attainsIdMap.set(attainsId, { feature, isAquaticLife });
                }
                // Otherwise keep existing (either both are Aquatic Life, or existing is Aquatic Life and current is not)
            }
        });
        
        // Collect unique features
        const uniqueFeatures = [
            ...featuresWithoutId,
            ...Array.from(attainsIdMap.values()).map(entry => entry.feature)
        ];
        
        const dedupedStreamsData = {
            type: 'FeatureCollection',
            features: uniqueFeatures
        };
        
        const aquaticLifeCount = Array.from(attainsIdMap.values()).filter(e => e.isAquaticLife).length;
        console.log(`Deduplicated streams: ${streamsData.features.length} -> ${uniqueFeatures.length} features`);
        console.log(`  - ${aquaticLifeCount} features with "Aquatic Life" category`);
        console.log(`  - ${attainsIdMap.size - aquaticLifeCount} features with other categories (no Aquatic Life available)`);
        console.log(`  - ${featuresWithoutId.length} features without ATTAINS_ID`);
        
        // Clip streams to watershed boundary using Turf.js
        const clippedStreams = clipStreamsToWatershed(dedupedStreamsData, watershedData);
        
        // Store the clipped streams
        BuilderState.streamsData = clippedStreams;
        
        // Update UI
        if (streamsBox) {
            streamsBox.classList.remove('loading');
            streamsBox.classList.add('loaded');
        }
        if (statusEl) {
            statusEl.className = 'file-status success';
            statusEl.innerHTML = `<i class="fas fa-check"></i> Fetched ${clippedStreams.features.length} stream segments`;
        }
        
        // Check if all data is ready
        checkAllFilesLoaded();
        
    } catch (error) {
        console.error('Error fetching streams:', error);
        
        if (streamsBox) {
            streamsBox.classList.remove('loading');
            streamsBox.classList.add('error');
        }
        if (statusEl) {
            statusEl.className = 'file-status error';
            statusEl.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
        }
    }
}

/**
 * Fetch municipality boundaries from PennDOT REST service
 */
async function fetchMunicipalitiesFromPennDOT(watershedData) {
    console.log('Fetching municipalities from PennDOT...');
    
    const municipalitiesBox = document.getElementById('municipalities-upload-box');
    const statusEl = document.getElementById('municipalities-status');
    
    // Show loading state
    if (municipalitiesBox) {
        municipalitiesBox.classList.remove('loaded', 'error');
        municipalitiesBox.classList.add('loading');
    }
    if (statusEl) {
        statusEl.className = 'file-status loading';
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching municipalities from PennDOT...';
    }
    
    // Create a dissolved/union watershed polygon for filtering
    let watershedUnion = null;
    let validWatershedFeatures = [];
    try {
        if (typeof turf !== 'undefined') {
            // Filter out any features with invalid or missing geometry
            validWatershedFeatures = watershedData.features.filter(f => {
                if (!f || !f.geometry || !f.geometry.type || !f.geometry.coordinates) {
                    console.warn('Skipping invalid watershed feature:', f);
                    return false;
                }
                // Additional check for empty coordinates
                if (Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length === 0) {
                    console.warn('Skipping watershed feature with empty coordinates');
                    return false;
                }
                return true;
            });
            
            console.log(`Found ${validWatershedFeatures.length} valid watershed features out of ${watershedData.features.length}`);
            
            if (validWatershedFeatures.length === 0) {
                console.warn('No valid watershed features found for union');
            } else if (validWatershedFeatures.length === 1) {
                watershedUnion = validWatershedFeatures[0];
                console.log('Single watershed feature, no union needed');
            } else {
                // Union all watershed polygons into one
                // Start with the first valid feature
                watershedUnion = validWatershedFeatures[0];
                
                for (let i = 1; i < validWatershedFeatures.length; i++) {
                    try {
                        const feature = validWatershedFeatures[i];
                        // Ensure both features are valid before union
                        if (watershedUnion && watershedUnion.geometry && feature && feature.geometry) {
                            const unionResult = turf.union(turf.featureCollection([watershedUnion, feature]));
                            if (unionResult && unionResult.geometry) {
                                watershedUnion = unionResult;
                            } else {
                                console.warn(`Union result invalid for feature ${i}, keeping previous union`);
                            }
                        }
                    } catch (e) {
                        console.warn(`Error unioning watershed polygon ${i}:`, e);
                        // Continue with the previous union result
                    }
                }
                console.log('Created watershed union for filtering');
            }
            
            // Validate the final union result
            if (watershedUnion && (!watershedUnion.geometry || !watershedUnion.geometry.type)) {
                console.warn('Final watershed union has invalid geometry, will use individual feature checks');
                watershedUnion = null;
            }
        }
    } catch (e) {
        console.warn('Error creating watershed union:', e);
        watershedUnion = null;
    }
    
    // Get bounding box from watershed data (use for REST query)
    const bbox = getBoundingBox(watershedData);
    
    // PennDOT REST service endpoint
    const baseUrl = 'https://gis.penndot.gov/arcgis/rest/services/crashgis/crashgis/MapServer/6/query';
    
    try {
        // Fetch all features using pagination (in case there are more than maxRecordCount)
        let allFeatures = [];
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
            // Use bounding box for REST query (polygon geometry can be too complex for URL)
            const params = new URLSearchParams({
                where: '1=1',
                geometry: JSON.stringify({
                    xmin: bbox[0],
                    ymin: bbox[1],
                    xmax: bbox[2],
                    ymax: bbox[3],
                    spatialReference: { wkid: 4326 }
                }),
                geometryType: 'esriGeometryEnvelope',
                inSR: '4326',
                spatialRel: 'esriSpatialRelIntersects',
                outFields: '*',
                outSR: '4326',
                resultOffset: offset,
                f: 'geojson'
            });
            
            const response = await fetch(`${baseUrl}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const geojson = await response.json();
            
            if (!geojson.features || geojson.features.length === 0) {
                hasMore = false;
            } else {
                allFeatures = allFeatures.concat(geojson.features);
                offset += geojson.features.length;
                
                // Update status with progress
                if (statusEl) {
                    statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Fetching municipalities (${allFeatures.length} so far)...`;
                }
                
                // Check if we got fewer features than a typical page size (indicates last page)
                if (geojson.features.length < 1000) {
                    hasMore = false;
                }
            }
        }
        
        if (allFeatures.length === 0) {
            console.warn('No municipalities found in bounding box');
            BuilderState.municipalityData = { type: 'FeatureCollection', features: [] };
            
            if (municipalitiesBox) {
                municipalitiesBox.classList.remove('loading');
                municipalitiesBox.classList.add('error');
            }
            if (statusEl) {
                statusEl.className = 'file-status error';
                statusEl.innerHTML = '<i class="fas fa-times"></i> No municipalities found';
            }
            return;
        }
        
        // Create GeoJSON object from all features
        const allMunicipalities = {
            type: 'FeatureCollection',
            features: allFeatures
        };
        
        console.log(`Fetched ${allFeatures.length} municipalities from REST service`);
        
        // Filter to only municipalities that intersect the watershed union (not just bounding box)
        let finalFeatures = allFeatures;
        const hasValidUnion = watershedUnion && watershedUnion.geometry && watershedUnion.geometry.type;
        const hasValidFeatures = validWatershedFeatures && validWatershedFeatures.length > 0;
        
        if (hasValidUnion || hasValidFeatures) {
            console.log('Filtering municipalities by watershed intersection...');
            if (hasValidUnion) {
                console.log('Using watershed union for filtering. Geometry type:', watershedUnion.geometry.type);
            } else {
                console.log('Union failed, will check against individual watershed features');
            }
            
            // Helper function to check if municipality intersects any watershed feature
            const intersectsWatershed = (municipality) => {
                // First try the union if available
                if (hasValidUnion) {
                    try {
                        if (turf.booleanIntersects(municipality, watershedUnion)) {
                            return true;
                        }
                    } catch (e) {
                        // Fall through to individual feature check
                    }
                }
                
                // If union check failed or wasn't available, check individual features
                for (const wsFeature of validWatershedFeatures) {
                    try {
                        if (turf.booleanIntersects(municipality, wsFeature)) {
                            return true;
                        }
                    } catch (e) {
                        // Continue to next feature
                    }
                }
                return false;
            };
            
            // Helper function to check if municipality centroid is in any watershed
            const centroidInWatershed = (municipality) => {
                try {
                    const centroid = turf.centroid(municipality);
                    if (!centroid) return false;
                    
                    // Try union first
                    if (hasValidUnion) {
                        try {
                            if (turf.booleanPointInPolygon(centroid, watershedUnion)) {
                                return true;
                            }
                        } catch (e) {
                            // Fall through
                        }
                    }
                    
                    // Check individual features
                    for (const wsFeature of validWatershedFeatures) {
                        try {
                            if (turf.booleanPointInPolygon(centroid, wsFeature)) {
                                return true;
                            }
                        } catch (e) {
                            // Continue
                        }
                    }
                } catch (e) {
                    // Centroid creation failed
                }
                return false;
            };
            
            finalFeatures = allFeatures.filter((municipality, index) => {
                // Validate municipality geometry first
                if (!municipality || !municipality.geometry || !municipality.geometry.type || !municipality.geometry.coordinates) {
                    console.warn(`Municipality ${index} has invalid geometry, excluding`);
                    return false;
                }
                
                const muniName = municipality.properties?.MUNICIPAL_NAME || municipality.properties?.MUN_NAME || `Municipality ${index}`;
                
                // Check intersection
                if (intersectsWatershed(municipality)) {
                    return true;
                }
                
                // Check centroid
                if (centroidInWatershed(municipality)) {
                    console.log(`${muniName} included via centroid check`);
                    return true;
                }
                
                // Log when a municipality is excluded
                console.log(`Municipality excluded: ${muniName}`);
                return false;
            });
            console.log(`Filtered to ${finalFeatures.length} municipalities (excluded ${allFeatures.length - finalFeatures.length})`);
        }
        
        // Store filtered municipalities
        BuilderState.municipalityData = {
            type: 'FeatureCollection',
            features: finalFeatures
        };
        
        // Update UI
        if (municipalitiesBox) {
            municipalitiesBox.classList.remove('loading');
            municipalitiesBox.classList.add('loaded');
        }
        if (statusEl) {
            statusEl.className = 'file-status success';
            statusEl.innerHTML = `<i class="fas fa-check"></i> Fetched ${finalFeatures.length} municipalities`;
        }
        
        // Check if all data is ready
        checkAllFilesLoaded();
        
    } catch (error) {
        console.error('Error fetching municipalities:', error);
        // Set empty data so we don't block the builder
        BuilderState.municipalityData = { type: 'FeatureCollection', features: [] };
        
        if (municipalitiesBox) {
            municipalitiesBox.classList.remove('loading');
            municipalitiesBox.classList.add('error');
        }
        if (statusEl) {
            statusEl.className = 'file-status error';
            statusEl.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
        }
    }
}

/**
 * Initialize parcel links input handlers
 */
function initParcelLinksHandlers() {
    // Clear button handlers
    document.querySelectorAll('.parcel-link-clear').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                input.value = '';
                updateParcelFetchButtonState();
            }
        });
    });
    
    // Input change handlers to enable/disable fetch button
    for (let i = 1; i <= 3; i++) {
        const input = document.getElementById(`parcel-link-${i}`);
        if (input) {
            input.addEventListener('input', updateParcelFetchButtonState);
        }
    }
    
    // Fetch button handler
    const fetchBtn = document.getElementById('fetch-parcels-btn');
    if (fetchBtn) {
        fetchBtn.addEventListener('click', function() {
            fetchParcelsFromLinks();
        });
    }
}

/**
 * Update the parcel fetch button state based on inputs and watershed
 */
function updateParcelFetchButtonState() {
    const fetchBtn = document.getElementById('fetch-parcels-btn');
    const statusEl = document.getElementById('parcels-status');
    if (!fetchBtn) return;
    
    // Check if at least one link is provided
    let hasLink = false;
    for (let i = 1; i <= 3; i++) {
        const input = document.getElementById(`parcel-link-${i}`);
        if (input && input.value.trim()) {
            hasLink = true;
            break;
        }
    }
    
    // Check if watershed is loaded
    const hasWatershed = BuilderState.watershedData !== null;
    
    // Enable button only if both conditions are met
    fetchBtn.disabled = !(hasLink && hasWatershed);
    
    // Update status text
    if (statusEl && !BuilderState.parcelData) {
        if (!hasWatershed) {
            statusEl.innerHTML = 'Upload watershed boundary first';
            statusEl.className = 'file-status';
        } else if (!hasLink) {
            statusEl.innerHTML = 'Enter at least one parcel service URL';
            statusEl.className = 'file-status';
        } else {
            statusEl.innerHTML = 'Ready to fetch parcels';
            statusEl.className = 'file-status';
        }
    }
}

/**
 * Fetch parcels from user-provided REST service links
 */
async function fetchParcelsFromLinks() {
    console.log('Fetching parcels from user-provided links...');
    
    const parcelsBox = document.getElementById('parcels-upload-box');
    const statusEl = document.getElementById('parcels-status');
    
    // Collect non-empty links
    const links = [];
    for (let i = 1; i <= 3; i++) {
        const input = document.getElementById(`parcel-link-${i}`);
        if (input && input.value.trim()) {
            links.push(input.value.trim());
        }
    }
    
    if (links.length === 0) {
        console.warn('No parcel links provided');
        return;
    }
    
    BuilderState.parcelLinks = links;
    
    // Show loading state
    if (parcelsBox) {
        parcelsBox.classList.remove('loaded', 'error');
        parcelsBox.classList.add('loading');
    }
    if (statusEl) {
        statusEl.className = 'file-status loading';
        statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Fetching parcels from ${links.length} source(s)...`;
    }
    
    // Create watershed union for filtering
    let watershedUnion = null;
    let validWatershedFeatures = [];
    try {
        if (typeof turf !== 'undefined' && BuilderState.watershedData) {
            validWatershedFeatures = BuilderState.watershedData.features.filter(f => {
                if (!f || !f.geometry || !f.geometry.type || !f.geometry.coordinates) {
                    return false;
                }
                if (Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length === 0) {
                    return false;
                }
                return true;
            });
            
            if (validWatershedFeatures.length === 1) {
                watershedUnion = validWatershedFeatures[0];
            } else if (validWatershedFeatures.length > 1) {
                watershedUnion = validWatershedFeatures[0];
                for (let i = 1; i < validWatershedFeatures.length; i++) {
                    try {
                        const feature = validWatershedFeatures[i];
                        if (watershedUnion && watershedUnion.geometry && feature && feature.geometry) {
                            const unionResult = turf.union(turf.featureCollection([watershedUnion, feature]));
                            if (unionResult && unionResult.geometry) {
                                watershedUnion = unionResult;
                            }
                        }
                    } catch (e) {
                        console.warn(`Error unioning watershed polygon ${i}:`, e);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Error creating watershed union for parcels:', e);
    }
    
    // Get bounding box from watershed
    const bbox = getBoundingBox(BuilderState.watershedData);
    
    try {
        // Fetch from all provided links
        let allParcels = [];
        
        for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
            const link = links[linkIndex];
            if (statusEl) {
                statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Fetching parcels from source ${linkIndex + 1}/${links.length}...`;
            }
            
            // Normalize the URL - ensure it ends with /query
            let baseUrl = link.trim();
            if (!baseUrl.endsWith('/query')) {
                baseUrl = baseUrl.replace(/\/$/, '') + '/query';
            }
            
            // Fetch with pagination
            let offset = 0;
            let hasMore = true;
            let sourceFeatures = [];
            
            while (hasMore) {
                const params = new URLSearchParams({
                    where: '1=1',
                    geometry: JSON.stringify({
                        xmin: bbox[0],
                        ymin: bbox[1],
                        xmax: bbox[2],
                        ymax: bbox[3],
                        spatialReference: { wkid: 4326 }
                    }),
                    geometryType: 'esriGeometryEnvelope',
                    inSR: '4326',
                    spatialRel: 'esriSpatialRelIntersects',
                    outFields: '*',
                    outSR: '4326',
                    resultOffset: offset,
                    f: 'geojson'
                });
                
                try {
                    const response = await fetch(`${baseUrl}?${params.toString()}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error: ${response.status}`);
                    }
                    
                    const geojson = await response.json();
                    
                    if (!geojson.features || geojson.features.length === 0) {
                        hasMore = false;
                    } else {
                        sourceFeatures = sourceFeatures.concat(geojson.features);
                        offset += geojson.features.length;
                        
                        if (statusEl) {
                            statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Source ${linkIndex + 1}: ${sourceFeatures.length} parcels fetched...`;
                        }
                        
                        // Check if we got fewer features than typical page size
                        if (geojson.features.length < 1000) {
                            hasMore = false;
                        }
                    }
                } catch (fetchError) {
                    console.error(`Error fetching from source ${linkIndex + 1}:`, fetchError);
                    hasMore = false;
                }
            }
            
            console.log(`Fetched ${sourceFeatures.length} parcels from source ${linkIndex + 1}`);
            allParcels = allParcels.concat(sourceFeatures);
        }
        
        if (allParcels.length === 0) {
            console.warn('No parcels found in bounding box');
            BuilderState.parcelData = null;
            
            if (parcelsBox) {
                parcelsBox.classList.remove('loading');
                parcelsBox.classList.add('error');
            }
            if (statusEl) {
                statusEl.className = 'file-status error';
                statusEl.innerHTML = '<i class="fas fa-times"></i> No parcels found in watershed area';
            }
            return;
        }
        
        console.log(`Total parcels fetched from all sources: ${allParcels.length}`);
        if (statusEl) {
            statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Filtering ${allParcels.length} parcels to watershed...`;
        }
        
        // Filter parcels to those that intersect watershed (keep original geometry)
        let finalFeatures = allParcels;
        const hasValidUnion = watershedUnion && watershedUnion.geometry && watershedUnion.geometry.type;
        const hasValidFeatures = validWatershedFeatures && validWatershedFeatures.length > 0;
        
        if (hasValidUnion || hasValidFeatures) {
            console.log('Filtering parcels by watershed intersection (keeping original geometry)...');
            
            // Helper function to check if parcel intersects watershed
            const intersectsWatershed = (parcel) => {
                if (hasValidUnion) {
                    try {
                        if (turf.booleanIntersects(parcel, watershedUnion)) {
                            return true;
                        }
                    } catch (e) {
                        // Fall through to individual feature check
                    }
                }
                
                for (const wsFeature of validWatershedFeatures) {
                    try {
                        if (turf.booleanIntersects(parcel, wsFeature)) {
                            return true;
                        }
                    } catch (e) {
                        // Continue
                    }
                }
                return false;
            };
            
            // Helper function for centroid check
            const centroidInWatershed = (parcel) => {
                try {
                    const centroid = turf.centroid(parcel);
                    if (!centroid) return false;
                    
                    if (hasValidUnion) {
                        try {
                            if (turf.booleanPointInPolygon(centroid, watershedUnion)) {
                                return true;
                            }
                        } catch (e) {}
                    }
                    
                    for (const wsFeature of validWatershedFeatures) {
                        try {
                            if (turf.booleanPointInPolygon(centroid, wsFeature)) {
                                return true;
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
                return false;
            };
            
            finalFeatures = allParcels.filter((parcel, index) => {
                if (!parcel || !parcel.geometry || !parcel.geometry.type || !parcel.geometry.coordinates) {
                    return false;
                }
                
                // Check intersection - keep original geometry if intersects
                if (intersectsWatershed(parcel)) {
                    return true;
                }
                
                // Check centroid as fallback
                if (centroidInWatershed(parcel)) {
                    return true;
                }
                
                return false;
            });
            
            console.log(`Filtered to ${finalFeatures.length} parcels (excluded ${allParcels.length - finalFeatures.length})`);
        }
        
        // Store filtered parcels
        BuilderState.parcelData = {
            type: 'FeatureCollection',
            features: finalFeatures
        };
        
        // Update UI
        if (parcelsBox) {
            parcelsBox.classList.remove('loading');
            parcelsBox.classList.add('loaded');
        }
        if (statusEl) {
            statusEl.className = 'file-status success';
            statusEl.innerHTML = `<i class="fas fa-check"></i> Fetched ${finalFeatures.length} parcels from ${links.length} source(s)`;
        }
        
        // Show parcel symbology controls
        const parcelSymbologyGroup = document.getElementById('parcels-symbology-group');
        if (parcelSymbologyGroup) {
            parcelSymbologyGroup.style.display = 'block';
        }
        
        // Check if all data is ready
        checkAllFilesLoaded();
        
    } catch (error) {
        console.error('Error fetching parcels:', error);
        BuilderState.parcelData = null;
        
        if (parcelsBox) {
            parcelsBox.classList.remove('loading');
            parcelsBox.classList.add('error');
        }
        if (statusEl) {
            statusEl.className = 'file-status error';
            statusEl.innerHTML = `<i class="fas fa-times"></i> Error: ${error.message}`;
        }
    }
}

/**
 * Filter municipalities to those that intersect watershed polygon (keep original geometry)
 */
function filterMunicipalitiesByWatershed(municipalityFeatures, watershedData) {
    // Check if Turf is available
    if (typeof turf === 'undefined') {
        console.warn('Turf.js not loaded, returning all municipalities');
        return municipalityFeatures;
    }
    
    try {
        // Create a union of all watershed polygons
        let watershedPolygon;
        if (watershedData.features.length === 1) {
            watershedPolygon = watershedData.features[0];
        } else {
            // Union multiple polygons
            watershedPolygon = watershedData.features[0];
            for (let i = 1; i < watershedData.features.length; i++) {
                try {
                    watershedPolygon = turf.union(turf.featureCollection([watershedPolygon, watershedData.features[i]]));
                } catch (e) {
                    console.warn('Error unioning watershed polygons:', e);
                }
            }
        }
        
        // Filter municipalities - keep original geometry if they intersect
        const filtered = [];
        
        municipalityFeatures.forEach(municipality => {
            try {
                // Check if municipality intersects watershed
                if (turf.booleanIntersects(municipality, watershedPolygon)) {
                    filtered.push(municipality);
                }
            } catch (e) {
                // If booleanIntersects fails, it might be due to geometry issues
                // Try a simpler check: does the centroid fall inside?
                try {
                    const centroid = turf.centroid(municipality);
                    if (turf.booleanPointInPolygon(centroid, watershedPolygon)) {
                        filtered.push(municipality);
                    }
                } catch (e2) {
                    console.warn('Error checking municipality intersection:', e2);
                }
            }
        });
        
        return filtered;
        
    } catch (error) {
        console.error('Error filtering municipalities:', error);
        return municipalityFeatures;
    }
}

/**
 * Get bounding box from GeoJSON
 */
function getBoundingBox(geojson) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    function processCoords(coords) {
        if (typeof coords[0] === 'number') {
            // Single coordinate pair
            minX = Math.min(minX, coords[0]);
            minY = Math.min(minY, coords[1]);
            maxX = Math.max(maxX, coords[0]);
            maxY = Math.max(maxY, coords[1]);
        } else {
            // Nested array
            coords.forEach(processCoords);
        }
    }
    
    geojson.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            processCoords(feature.geometry.coordinates);
        }
    });
    
    // Add small buffer (about 500m in degrees)
    const buffer = 0.005;
    return [minX - buffer, minY - buffer, maxX + buffer, maxY + buffer];
}

/**
 * Clip streams to watershed boundary using Turf.js
 */
function clipStreamsToWatershed(streamsData, watershedData) {
    // Check if Turf is available
    if (typeof turf === 'undefined') {
        console.warn('Turf.js not loaded, returning unclipped streams');
        return streamsData;
    }
    
    try {
        // Create a union of all watershed polygons
        let watershedPolygon;
        if (watershedData.features.length === 1) {
            watershedPolygon = watershedData.features[0];
        } else {
            // Union multiple polygons
            watershedPolygon = watershedData.features[0];
            for (let i = 1; i < watershedData.features.length; i++) {
                try {
                    watershedPolygon = turf.union(watershedPolygon, watershedData.features[i]);
                } catch (e) {
                    console.warn('Union failed for polygon', i);
                }
            }
        }
        
        // Clip each stream line
        const clippedFeatures = [];
        streamsData.features.forEach(streamFeature => {
            try {
                const coords = streamFeature.geometry.coordinates;
                
                // First check: is stream entirely within the watershed?
                // Check multiple points along the line
                let pointsInside = 0;
                let totalPoints = 0;
                
                if (streamFeature.geometry.type === 'LineString') {
                    coords.forEach(coord => {
                        totalPoints++;
                        if (turf.booleanPointInPolygon(turf.point(coord), watershedPolygon)) {
                            pointsInside++;
                        }
                    });
                } else if (streamFeature.geometry.type === 'MultiLineString') {
                    coords.forEach(line => {
                        line.forEach(coord => {
                            totalPoints++;
                            if (turf.booleanPointInPolygon(turf.point(coord), watershedPolygon)) {
                                pointsInside++;
                            }
                        });
                    });
                }
                
                // If most points are inside, include the stream
                if (totalPoints > 0 && (pointsInside / totalPoints) > 0.3) {
                    clippedFeatures.push(streamFeature);
                    return;
                }
                
                // Second check: does stream intersect watershed?
                if (turf.booleanIntersects(streamFeature, watershedPolygon)) {
                    // Try to clip using booleanWithin for line segments
                    try {
                        const clipped = turf.lineIntersect(streamFeature, turf.polygonToLine(watershedPolygon));
                        // If there are intersection points, include the stream
                        if (clipped && clipped.features && clipped.features.length > 0) {
                            clippedFeatures.push(streamFeature);
                        }
                    } catch (e) {
                        // Fallback: just include if it intersects
                        clippedFeatures.push(streamFeature);
                    }
                }
            } catch (clipError) {
                console.warn('Clipping failed for stream segment:', clipError.message);
            }
        });
        
        console.log(`Clipped streams: ${clippedFeatures.length} of ${streamsData.features.length}`);
        
        return {
            type: 'FeatureCollection',
            features: clippedFeatures
        };
        
    } catch (error) {
        console.warn('Clipping failed, returning all streams:', error);
        return streamsData;
    }
}

/**
 * Initialize the symbology editor
 */
function initSymbologyEditor() {
    // Initialize collapse/expand handlers for layer groups
    document.querySelectorAll('.symbology-layer-header').forEach(header => {
        // Prevent duplicate event listeners
        if (header.dataset.listenerAdded) return;
        header.dataset.listenerAdded = 'true';
        
        header.addEventListener('click', function(e) {
            e.stopPropagation();
            const targetId = this.getAttribute('data-target');
            const content = document.getElementById(targetId);
            const icon = this.querySelector('.collapse-icon');
            
            if (!content) {
                console.warn('Symbology target not found:', targetId);
                return;
            }
            
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                if (icon) icon.classList.remove('collapsed');
                this.classList.add('open');
            } else {
                content.classList.add('collapsed');
                if (icon) icon.classList.add('collapsed');
                this.classList.remove('open');
            }
        });
    });
    
    // Watershed symbology handlers
    initLayerSymbology('watershed', true);
    
    // Municipalities symbology handlers
    initLayerSymbology('municipalities', true);
    
    // Parcels symbology handlers
    initLayerSymbology('parcels', true);
    
    // Streams symbology handlers (with color-by-field support)
    initStreamsSymbology();
    
    // Points symbology handlers
    initPointsSymbology();
    
    // Map legend toggle
    initMapLegendToggle();
    
    // Update color previews
    updateSymbologyPreviews();
}

/**
 * Initialize symbology handlers for polygon/line layers
 */
function initLayerSymbology(layerName, hasFill) {
    const strokeColorEl = document.getElementById(`${layerName}-stroke-color`);
    const strokeWidthEl = document.getElementById(`${layerName}-stroke-width`);
    const lineDashEl = document.getElementById(`${layerName}-line-dash`);
    
    if (strokeColorEl) {
        strokeColorEl.addEventListener('input', function() {
            BuilderState.symbology[layerName].strokeColor = this.value;
            updateSymbologyPreviews();
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle(layerName);
            }
        });
    }
    
    if (strokeWidthEl) {
        strokeWidthEl.addEventListener('input', function() {
            BuilderState.symbology[layerName].strokeWidth = parseFloat(this.value);
            this.nextElementSibling.textContent = this.value + 'px';
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle(layerName);
            }
        });
    }
    
    if (lineDashEl) {
        lineDashEl.addEventListener('change', function() {
            BuilderState.symbology[layerName].lineDash = this.value;
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle(layerName);
            }
        });
    }
    
    if (hasFill) {
        const fillColorEl = document.getElementById(`${layerName}-fill-color`);
        const fillOpacityEl = document.getElementById(`${layerName}-fill-opacity`);
        
        const updateFill = function() {
            const color = fillColorEl.value;
            const opacity = parseInt(fillOpacityEl.value) / 100;
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            BuilderState.symbology[layerName].fillColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            fillOpacityEl.nextElementSibling.textContent = fillOpacityEl.value + '%';
            updateSymbologyPreviews();
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle(layerName);
            }
        };
        
        if (fillColorEl) fillColorEl.addEventListener('input', updateFill);
        if (fillOpacityEl) fillOpacityEl.addEventListener('input', updateFill);
    }
}

/**
 * Initialize streams symbology handlers (with color-by-field support)
 */
function initStreamsSymbology() {
    const modeEl = document.getElementById('streams-mode');
    const colorFieldEl = document.getElementById('streams-color-field');
    const strokeColorEl = document.getElementById('streams-stroke-color');
    const strokeWidthEl = document.getElementById('streams-stroke-width');
    const lineDashEl = document.getElementById('streams-line-dash');
    
    // Mode change handler
    if (modeEl) {
        modeEl.addEventListener('change', function() {
            BuilderState.symbology.streams.mode = this.value;
            
            // Toggle visibility of options
            const plainOptions = document.getElementById('streams-plain-options');
            const byFieldOptions = document.getElementById('streams-byfield-options');
            
            if (this.value === 'byField') {
                if (plainOptions) plainOptions.style.display = 'none';
                if (byFieldOptions) byFieldOptions.style.display = 'block';
            } else {
                if (plainOptions) plainOptions.style.display = 'block';
                if (byFieldOptions) byFieldOptions.style.display = 'none';
            }
            
            updateSymbologyPreviews();
            updateMapLegend();
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('streams');
            }
        });
    }
    
    // Color field change handler
    if (colorFieldEl) {
        colorFieldEl.addEventListener('change', function() {
            BuilderState.symbology.streams.colorField = this.value;
            // Clear existing colorMap to force regeneration for new field
            BuilderState.symbology.streams.colorMap = {};
            generateStreamsColorLegend();
            updateMapLegend();
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('streams');
            }
        });
    }
    
    // Plain stroke color handler
    if (strokeColorEl) {
        strokeColorEl.addEventListener('input', function() {
            BuilderState.symbology.streams.strokeColor = this.value;
            updateSymbologyPreviews();
            updateMapLegend();
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('streams');
            }
        });
    }
    
    // Stroke width handler
    if (strokeWidthEl) {
        strokeWidthEl.addEventListener('input', function() {
            BuilderState.symbology.streams.strokeWidth = parseFloat(this.value);
            this.nextElementSibling.textContent = this.value + 'px';
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('streams');
            }
        });
    }
    
    // Line dash handler
    if (lineDashEl) {
        lineDashEl.addEventListener('change', function() {
            BuilderState.symbology.streams.lineDash = this.value;
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('streams');
            }
        });
    }
}

/**
 * Initialize points symbology handlers
 */
function initPointsSymbology() {
    const modeEl = document.getElementById('points-mode');
    const colorFieldEl = document.getElementById('points-color-field');
    const plainColorEl = document.getElementById('points-plain-color');
    const strokeColorEl = document.getElementById('points-stroke-color');
    const strokeWidthEl = document.getElementById('points-stroke-width');
    const radiusEl = document.getElementById('points-radius');
    
    // Mode change handler
    if (modeEl) {
        modeEl.addEventListener('change', function() {
            BuilderState.symbology.points.mode = this.value;
            
            // Toggle visibility of options
            const byFieldOptions = document.querySelectorAll('.points-byfield-options');
            const plainOptions = document.querySelectorAll('.points-plain-options');
            const colorLegend = document.getElementById('points-color-legend');
            
            if (this.value === 'byField') {
                byFieldOptions.forEach(el => el.style.display = 'flex');
                plainOptions.forEach(el => el.style.display = 'none');
                if (colorLegend) colorLegend.style.display = 'block';
            } else {
                byFieldOptions.forEach(el => el.style.display = 'none');
                plainOptions.forEach(el => el.style.display = 'flex');
                if (colorLegend) colorLegend.style.display = 'none';
            }
            
            updateSymbologyPreviews();
            updateMapLegend(); // Update map legend when mode changes
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
    }
    
    // Color field change handler
    if (colorFieldEl) {
        colorFieldEl.addEventListener('change', function() {
            BuilderState.symbology.points.colorField = this.value;
            // Clear existing colorMap to force regeneration for new field
            BuilderState.symbology.points.colorMap = {};
            generateColorLegend();
            updateMapLegend(); // Update map legend when field changes
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
    }
    
    // Plain color handler
    if (plainColorEl) {
        plainColorEl.addEventListener('input', function() {
            BuilderState.symbology.points.plainColor = this.value;
            updateSymbologyPreviews();
            updateMapLegend(); // Update map legend when plain color changes
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
    }
    
    // Stroke color handler
    if (strokeColorEl) {
        strokeColorEl.addEventListener('input', function() {
            BuilderState.symbology.points.strokeColor = this.value;
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
    }
    
    // Stroke width handler
    if (strokeWidthEl) {
        strokeWidthEl.addEventListener('input', function() {
            BuilderState.symbology.points.strokeWidth = parseFloat(this.value);
            this.nextElementSibling.textContent = this.value + 'px';
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
    }
    
    // Radius handler
    if (radiusEl) {
        radiusEl.addEventListener('input', function() {
            BuilderState.symbology.points.radius = parseInt(this.value);
            this.nextElementSibling.textContent = this.value + 'px';
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
    }
}

/**
 * Update color field options when project data is loaded
 */
function updatePointsColorFieldOptions() {
    const colorFieldEl = document.getElementById('points-color-field');
    const modeEl = document.getElementById('points-mode');
    
    // Sync mode selector to match BuilderState
    if (modeEl) {
        modeEl.value = BuilderState.symbology.points.mode;
        
        // Update visibility of options based on current mode
        const byFieldOptions = document.querySelectorAll('.points-byfield-options');
        const plainOptions = document.querySelectorAll('.points-plain-options');
        const colorLegend = document.getElementById('points-color-legend');
        
        if (BuilderState.symbology.points.mode === 'byField') {
            byFieldOptions.forEach(el => el.style.display = 'flex');
            plainOptions.forEach(el => el.style.display = 'none');
            if (colorLegend) colorLegend.style.display = 'block';
        } else {
            byFieldOptions.forEach(el => el.style.display = 'none');
            plainOptions.forEach(el => el.style.display = 'flex');
            if (colorLegend) colorLegend.style.display = 'none';
        }
    }
    
    if (!colorFieldEl || !BuilderState.availableFields.length) return;
    
    // Remember the current color field (may have been set during data load)
    // If it's null or not in availableFields, we'll select the first one
    let currentColorField = BuilderState.symbology.points.colorField;
    
    // Validate that currentColorField exists in the actual data
    if (currentColorField && !BuilderState.availableFields.includes(currentColorField)) {
        console.warn(`Color field "${currentColorField}" not found in available fields. Resetting.`);
        currentColorField = null;
    }
    
    colorFieldEl.innerHTML = '';
    
    // Add available fields
    let foundCurrentField = false;
    BuilderState.availableFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        
        // Select the field that was already set (from initPointsColorField)
        if (field === currentColorField) {
            option.selected = true;
            foundCurrentField = true;
        }
        colorFieldEl.appendChild(option);
    });
    
    // If current field wasn't found, select the first one
    if (!foundCurrentField && BuilderState.availableFields.length > 0) {
        colorFieldEl.value = BuilderState.availableFields[0];
        BuilderState.symbology.points.colorField = BuilderState.availableFields[0];
    }
    
    // Only generate color legend if in byField mode
    if (BuilderState.symbology.points.mode === 'byField') {
        generateColorLegend();
    }
}

/**
 * Generate color legend for field values
 */
function generateColorLegend() {
    const legendContainer = document.getElementById('color-legend-items');
    const colorLegendSection = document.getElementById('points-color-legend');
    
    if (!legendContainer || !BuilderState.projectsData) return;
    
    const field = BuilderState.symbology.points.colorField;
    if (!field) return;
    
    // Get unique values and counts
    const valueCounts = {};
    
    // Debug: Check first feature to see what properties exist
    if (BuilderState.projectsData.features.length > 0) {
        const firstFeature = BuilderState.projectsData.features[0];
        console.log('Color Legend - Looking for field:', field);
        console.log('First feature properties keys:', Object.keys(firstFeature.properties || {}));
        console.log('First feature property value for field:', firstFeature.properties[field]);
        
        // Try case-insensitive match if exact match fails
        if (firstFeature.properties[field] === undefined) {
            const lowerField = field.toLowerCase();
            const actualField = Object.keys(firstFeature.properties).find(k => k.toLowerCase() === lowerField);
            if (actualField) {
                console.warn(`Field case mismatch: looking for "${field}" but found "${actualField}"`);
            }
        }
    }
    
    BuilderState.projectsData.features.forEach(feature => {
        // Get the value - handle null, undefined, and empty strings
        let value = feature.properties[field];
        if (value === null || value === undefined || value === '') {
            value = '(Null/Empty)';
        } else {
            value = String(value); // Ensure it's a string
        }
        valueCounts[value] = (valueCounts[value] || 0) + 1;
    });
    
    // Sort by count
    const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
    
    // Check for too many unique values
    if (sortedValues.length > 30) {
        legendContainer.innerHTML = `
            <div class="too-many-values-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Too many unique values (${sortedValues.length}). Please select a field with 30 or fewer unique values for color classification.</span>
            </div>
        `;
        BuilderState.symbology.points.colorMap = {};
        if (colorLegendSection) colorLegendSection.style.display = 'block';
        return;
    }
    
    // Check if we already have a valid colorMap for this field
    const existingColorMap = BuilderState.symbology.points.colorMap || {};
    const hasValidColorMap = Object.keys(existingColorMap).length > 0 && 
                             sortedValues.every(([value]) => existingColorMap[value]);
    
    // Generate colors and build legend
    legendContainer.innerHTML = '';
    if (!hasValidColorMap) {
        BuilderState.symbology.points.colorMap = {};
    }
    
    sortedValues.forEach(([value, count], index) => {
        // Use existing color or generate new one
        let color;
        if (hasValidColorMap && existingColorMap[value]) {
            color = existingColorMap[value];
        } else {
            color = generateColorForValue(value, index, sortedValues.length);
            BuilderState.symbology.points.colorMap[value] = color;
        }
        
        const item = document.createElement('div');
        item.className = 'color-legend-item';
        item.innerHTML = `
            <input type="color" value="${color}" data-value="${escapeHtml(value)}">
            <span class="legend-label" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
            <span class="legend-count">${count}</span>
        `;
        
        // Add change handler for color picker
        const colorInput = item.querySelector('input[type="color"]');
        colorInput.addEventListener('input', function() {
            const val = this.getAttribute('data-value');
            BuilderState.symbology.points.colorMap[val] = this.value;
            updateSymbologyPreviews();
            updateMapLegend(); // Update map legend when colors change
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('points');
            }
        });
        
        legendContainer.appendChild(item);
    });
    
    // Show legend section
    if (colorLegendSection && BuilderState.symbology.points.mode === 'byField') {
        colorLegendSection.style.display = 'block';
    }
    
    // Update map legend if it's visible
    updateMapLegend();
}

/**
 * Update streams color field options when streams data is loaded
 */
function updateStreamsColorFieldOptions() {
    const colorFieldEl = document.getElementById('streams-color-field');
    const modeEl = document.getElementById('streams-mode');
    
    // Sync mode selector to match BuilderState
    if (modeEl) {
        modeEl.value = BuilderState.symbology.streams.mode;
        
        // Update visibility of options based on current mode
        const plainOptions = document.getElementById('streams-plain-options');
        const byFieldOptions = document.getElementById('streams-byfield-options');
        
        if (BuilderState.symbology.streams.mode === 'byField') {
            if (plainOptions) plainOptions.style.display = 'none';
            if (byFieldOptions) byFieldOptions.style.display = 'block';
        } else {
            if (plainOptions) plainOptions.style.display = 'block';
            if (byFieldOptions) byFieldOptions.style.display = 'none';
        }
    }
    
    if (!colorFieldEl || !BuilderState.streamsData || !BuilderState.streamsData.features.length) return;
    
    // Get available fields from streams data
    const firstFeature = BuilderState.streamsData.features[0];
    const availableFields = Object.keys(firstFeature.properties || {});
    
    // Remember the current color field
    let currentColorField = BuilderState.symbology.streams.colorField;
    
    // Validate that currentColorField exists in the actual data
    if (currentColorField && !availableFields.includes(currentColorField)) {
        console.warn(`Streams color field "${currentColorField}" not found in available fields. Resetting.`);
        currentColorField = null;
    }
    
    colorFieldEl.innerHTML = '';
    
    // Add available fields (filter to reasonable fields for color classification)
    let foundCurrentField = false;
    availableFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        
        // Select the field that was already set
        if (field === currentColorField) {
            option.selected = true;
            foundCurrentField = true;
        }
        colorFieldEl.appendChild(option);
    });
    
    // If current field wasn't found, select the first one
    if (!foundCurrentField && availableFields.length > 0) {
        colorFieldEl.value = availableFields[0];
        BuilderState.symbology.streams.colorField = availableFields[0];
    }
    
    // Only generate color legend if in byField mode
    if (BuilderState.symbology.streams.mode === 'byField') {
        generateStreamsColorLegend();
    }
}

/**
 * Generate color legend for streams field values
 */
function generateStreamsColorLegend() {
    const legendContainer = document.getElementById('streams-color-legend');
    
    if (!legendContainer || !BuilderState.streamsData) return;
    
    const field = BuilderState.symbology.streams.colorField;
    if (!field) return;
    
    // Get unique values and counts
    const valueCounts = {};
    
    BuilderState.streamsData.features.forEach(feature => {
        // Get the value - handle null, undefined, and empty strings
        let value = feature.properties[field];
        if (value === null || value === undefined || value === '') {
            value = '(Null/Empty)';
        } else {
            value = String(value); // Ensure it's a string
        }
        valueCounts[value] = (valueCounts[value] || 0) + 1;
    });
    
    // Sort by count
    const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
    
    // Check for too many unique values
    if (sortedValues.length > 30) {
        legendContainer.innerHTML = `
            <div class="too-many-values-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Too many unique values (${sortedValues.length}). Please select a field with 30 or fewer unique values for color classification.</span>
            </div>
        `;
        BuilderState.symbology.streams.colorMap = {};
        return;
    }
    
    // Check if we already have a valid colorMap for this field
    const existingColorMap = BuilderState.symbology.streams.colorMap || {};
    const hasValidColorMap = Object.keys(existingColorMap).length > 0 && 
                             sortedValues.every(([value]) => existingColorMap[value]);
    
    // Generate colors and build legend
    legendContainer.innerHTML = '';
    if (!hasValidColorMap) {
        BuilderState.symbology.streams.colorMap = {};
    }
    
    sortedValues.forEach(([value, count], index) => {
        // Use existing color or generate new one
        let color;
        if (hasValidColorMap && existingColorMap[value]) {
            color = existingColorMap[value];
        } else {
            color = generateColorForValue(value, index, sortedValues.length);
            BuilderState.symbology.streams.colorMap[value] = color;
        }
        
        const item = document.createElement('div');
        item.className = 'color-legend-item';
        item.innerHTML = `
            <input type="color" value="${color}" data-value="${escapeHtml(value)}">
            <span class="legend-label" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
            <span class="legend-count">${count}</span>
        `;
        
        // Add change handler for color picker
        const colorInput = item.querySelector('input[type="color"]');
        colorInput.addEventListener('input', function() {
            const val = this.getAttribute('data-value');
            BuilderState.symbology.streams.colorMap[val] = this.value;
            updateSymbologyPreviews();
            updateMapLegend();
            if (typeof PreviewMode !== 'undefined' && PreviewMode.updateLayerStyle) {
                PreviewMode.updateLayerStyle('streams');
            }
        });
        
        legendContainer.appendChild(item);
    });
    
    // Update map legend if it's visible
    updateMapLegend();
}

/**
 * Update the dynamic map legend - shows all layers
 */
function updateMapLegend() {
    const mapLegend = document.getElementById('map-legend');
    const legendContent = document.getElementById('map-legend-content');
    const showLegendCheckbox = document.getElementById('show-map-legend');
    
    if (!legendContent || !mapLegend) return;
    
    const sym = BuilderState.symbology;
    
    // Clear existing content
    legendContent.innerHTML = '';
    
    // Watershed Boundary
    if (BuilderState.watershedData) {
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = `
            <div class="map-legend-color map-legend-line" style="background-color: ${sym.watershed.strokeColor}; border-radius: 0; height: 4px;"></div>
            <span class="map-legend-label">Watershed Boundary</span>
        `;
        legendContent.appendChild(item);
    }
    
    // Streams
    if (BuilderState.streamsData) {
        const streamsSym = sym.streams;
        
        if (streamsSym.mode === 'byField' && streamsSym.colorMap && Object.keys(streamsSym.colorMap).length > 0) {
            // Add section header for streams
            const header = document.createElement('div');
            header.className = 'map-legend-section-header';
            header.textContent = 'Streams';
            legendContent.appendChild(header);
            
            // Get sorted values (by count, descending)
            const valueCounts = {};
            const field = streamsSym.colorField;
            BuilderState.streamsData.features.forEach(feature => {
                let value = feature.properties[field];
                if (value === null || value === undefined || value === '') {
                    value = '(Null/Empty)';
                } else {
                    value = String(value);
                }
                valueCounts[value] = (valueCounts[value] || 0) + 1;
            });
            
            const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
            
            // Check if there are too many values to display
            if (sortedValues.length > 30) {
                const warning = document.createElement('div');
                warning.className = 'map-legend-warning';
                warning.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Too many values (${sortedValues.length}) to display in legend</span>
                `;
                legendContent.appendChild(warning);
            } else {
                // Display the legend items as lines
                sortedValues.forEach(([value, count]) => {
                    const color = streamsSym.colorMap[value] || '#999999';
                    
                    const item = document.createElement('div');
                    item.className = 'map-legend-item map-legend-subitem';
                    item.title = `${value} (${count})`;
                    item.innerHTML = `
                        <div class="map-legend-color map-legend-line" style="background-color: ${color}; border-radius: 0; height: 3px;"></div>
                        <span class="map-legend-label">${escapeHtml(value)}</span>
                    `;
                    legendContent.appendChild(item);
                });
            }
        } else {
            // Single color mode
            const item = document.createElement('div');
            item.className = 'map-legend-item';
            item.innerHTML = `
                <div class="map-legend-color map-legend-line" style="background-color: ${streamsSym.strokeColor}; border-radius: 0; height: 3px;"></div>
                <span class="map-legend-label">Streams</span>
            `;
            legendContent.appendChild(item);
        }
    }
    
    // Municipalities
    if (BuilderState.municipalityData) {
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = `
            <div class="map-legend-color map-legend-line" style="background-color: ${sym.municipalities.strokeColor}; border-radius: 0; height: 3px; border-style: dashed;"></div>
            <span class="map-legend-label">Municipalities</span>
        `;
        legendContent.appendChild(item);
    }
    
    // Parcels
    if (BuilderState.parcelData && BuilderState.parcelData.features && BuilderState.parcelData.features.length > 0) {
        const parcelSym = sym.parcels;
        const borderStyle = parcelSym.lineDash === 'dashed' ? 'border-style: dashed;' : 
                           parcelSym.lineDash === 'dotted' ? 'border-style: dotted;' : '';
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = `
            <div class="map-legend-color map-legend-line" style="background-color: ${parcelSym.strokeColor}; border-radius: 0; height: 3px; ${borderStyle}"></div>
            <span class="map-legend-label">Parcels</span>
        `;
        legendContent.appendChild(item);
    }
    
    // Project Points - always in a separate section with blue divider
    if (BuilderState.projectsData) {
        const pointsSym = sym.points;
        
        // Add section header for points (with blue divider)
        const header = document.createElement('div');
        header.className = 'map-legend-section-header';
        header.textContent = 'Project Points';
        legendContent.appendChild(header);
        
        if (pointsSym.mode === 'plain') {
            // Single color mode
            const item = document.createElement('div');
            item.className = 'map-legend-item map-legend-subitem';
            item.innerHTML = `
                <div class="map-legend-color" style="background-color: ${pointsSym.plainColor}"></div>
                <span class="map-legend-label">All Projects</span>
            `;
            legendContent.appendChild(item);
        } else if (pointsSym.mode === 'byField' && pointsSym.colorMap) {
            // Color by field mode
            const field = pointsSym.colorField;
            
            // Get sorted values (by count, descending)
            const valueCounts = {};
            BuilderState.projectsData.features.forEach(feature => {
                let value = feature.properties[field];
                if (value === null || value === undefined || value === '') {
                    value = '(Null/Empty)';
                } else {
                    value = String(value);
                }
                valueCounts[value] = (valueCounts[value] || 0) + 1;
            });
            
            const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
            
            // Check if there are too many values to display (30+ limit)
            if (sortedValues.length > 30) {
                const warning = document.createElement('div');
                warning.className = 'map-legend-warning';
                warning.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Too many values (${sortedValues.length}) to display in legend</span>
                `;
                legendContent.appendChild(warning);
            } else {
                // Display the legend items
                sortedValues.forEach(([value, count]) => {
                    const color = pointsSym.colorMap[value] || '#999999';
                    
                    const item = document.createElement('div');
                    item.className = 'map-legend-item map-legend-subitem';
                    item.title = `${value} (${count})`;
                    item.innerHTML = `
                        <div class="map-legend-color" style="background-color: ${color}"></div>
                        <span class="map-legend-label">${escapeHtml(value)}</span>
                    `;
                    legendContent.appendChild(item);
                });
            }
        }
    }
    
    // Show/hide legend based on checkbox
    if (showLegendCheckbox && showLegendCheckbox.checked) {
        mapLegend.classList.remove('hidden');
    }
}

/**
 * Initialize map legend toggle
 */
function initMapLegendToggle() {
    const showLegendCheckbox = document.getElementById('show-map-legend');
    const mapLegend = document.getElementById('map-legend');
    const mapLegendClose = document.getElementById('map-legend-close');
    
    if (showLegendCheckbox && mapLegend) {
        showLegendCheckbox.addEventListener('change', function() {
            if (this.checked) {
                updateMapLegend();
                mapLegend.classList.remove('hidden');
            } else {
                mapLegend.classList.add('hidden');
            }
        });
    }
    
    if (mapLegendClose && mapLegend && showLegendCheckbox) {
        mapLegendClose.addEventListener('click', function() {
            mapLegend.classList.add('hidden');
            showLegendCheckbox.checked = false;
        });
    }
}

/**
 * Generate a color for a value
 */
function generateColorForValue(value, index, total) {
    // Use a pleasing color palette
    const palette = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
        '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
        '#86bcb6', '#8cd17d', '#b6992d', '#499894', '#e17d72'
    ];
    
    if (index < palette.length) {
        return palette[index];
    }
    
    // Generate additional colors using HSL
    const h = (index * 137.508) % 360; // Golden angle approximation
    return `hsl(${h}, 60%, 50%)`;
}

/**
 * Update symbology color previews
 */
function updateSymbologyPreviews() {
    // Watershed preview
    const watershedPreview = document.getElementById('watershed-preview');
    if (watershedPreview) {
        watershedPreview.style.background = BuilderState.symbology.watershed.strokeColor;
        watershedPreview.style.borderColor = BuilderState.symbology.watershed.strokeColor;
    }
    
    // Municipalities preview
    const municipalitiesPreview = document.getElementById('municipalities-preview');
    if (municipalitiesPreview) {
        municipalitiesPreview.style.background = BuilderState.symbology.municipalities.strokeColor;
        municipalitiesPreview.style.borderColor = BuilderState.symbology.municipalities.strokeColor;
    }
    
    // Parcels preview
    const parcelsPreview = document.getElementById('parcels-preview');
    if (parcelsPreview) {
        parcelsPreview.style.background = BuilderState.symbology.parcels.strokeColor;
        parcelsPreview.style.borderColor = BuilderState.symbology.parcels.strokeColor;
    }
    
    // Streams preview
    const streamsPreview = document.getElementById('streams-preview');
    if (streamsPreview) {
        if (BuilderState.symbology.streams.mode === 'byField') {
            // Gradient for byField mode
            const colors = Object.values(BuilderState.symbology.streams.colorMap);
            if (colors.length > 0) {
                streamsPreview.style.background = `linear-gradient(135deg, ${colors.slice(0, 4).join(', ')})`;
                streamsPreview.style.borderColor = '#333';
            } else {
                streamsPreview.style.background = BuilderState.symbology.streams.strokeColor;
                streamsPreview.style.borderColor = BuilderState.symbology.streams.strokeColor;
            }
        } else {
            streamsPreview.style.background = BuilderState.symbology.streams.strokeColor;
            streamsPreview.style.borderColor = BuilderState.symbology.streams.strokeColor;
        }
    }
    
    // Points preview
    const pointsPreview = document.getElementById('points-preview');
    if (pointsPreview) {
        if (BuilderState.symbology.points.mode === 'plain') {
            pointsPreview.style.background = BuilderState.symbology.points.plainColor;
            pointsPreview.style.borderColor = BuilderState.symbology.points.strokeColor;
        } else {
            // Gradient for byField mode
            const colors = Object.values(BuilderState.symbology.points.colorMap);
            if (colors.length > 0) {
                pointsPreview.style.background = `linear-gradient(135deg, ${colors.slice(0, 4).join(', ')})`;
                pointsPreview.style.borderColor = '#333';
            } else {
                pointsPreview.style.background = '#5a9fd4';
                pointsPreview.style.borderColor = '#333';
            }
        }
    }
}

/**
 * Initialize symbology panel (called when preview mode is activated)
 */
function initSymbologyPanel() {
    const btn = document.querySelector('#symbology-btn button');
    const panel = document.getElementById('symbology-panel');
    const closeBtn = document.getElementById('symbology-panel-close');
    
    if (!btn || !panel) return;
    
    // Toggle panel on button click
    btn.addEventListener('click', function() {
        const isHidden = panel.classList.contains('hidden');
        if (isHidden) {
            panel.classList.remove('hidden');
            btn.classList.add('active');
            // Initialize symbology handlers if not already done
            if (!panel.dataset.initialized) {
                initSymbologyEditor();
                updatePointsColorFieldOptions();
                updateStreamsColorFieldOptions();
                updateSymbologyPreviews();
                panel.dataset.initialized = 'true';
            }
        } else {
            panel.classList.add('hidden');
            btn.classList.remove('active');
        }
    });
    
    // Close panel on close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            panel.classList.add('hidden');
            btn.classList.remove('active');
        });
    }
}

/**
 * Show symbology section after data is loaded (legacy - now handled by panel)
 */
function showSymbologySection() {
    // Panel is shown via button toggle now
    // Just make sure color field options are updated
    updatePointsColorFieldOptions();
    updateStreamsColorFieldOptions();
}

/**
 * Escape HTML for safe insertion
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
