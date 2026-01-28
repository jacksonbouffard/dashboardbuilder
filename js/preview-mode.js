/* ===========================================
   Watershed Dashboard Builder - Preview Mode
   =========================================== */

/**
 * Preview Mode Module
 */
const PreviewMode = {
    map: null,
    projectLayer: null,
    streamsLayer: null,
    watershedLayer: null,
    municipalityLayer: null,
    parcelLayer: null,
    parcelHighlightLayer: null,
    highlightedParcelFeature: null,
    popup: null,
    initialExtent: null,
    activeFilters: {
        projectTypes: [],
        municipalities: [],
        watersheds: [],
        search: ''
    },
    
    /**
     * Initialize the preview map
     */
    init: function() {
        this.createMap();
        this.createLayers();
        this.initPopup();
        this.initFilters();
        this.initSidebarToggle();
        this.initDownloadButton();
        this.initResetExtentButton();
        this.updateFeatureCounter();
        
        // Initialize symbology panel
        if (typeof initSymbologyPanel === 'function') {
            initSymbologyPanel();
        }
    },
    
    /**
     * Create the OpenLayers map
     */
    createMap: function() {
        // Register proj4
        if (typeof ol.proj.proj4 !== 'undefined' && typeof proj4 !== 'undefined') {
            ol.proj.proj4.register(proj4);
        }
        
        // Base layers
        const osmLayer = new ol.layer.Tile({
            title: 'OpenStreetMap',
            opacity: 1.0,
            visible: false,
            source: new ol.source.XYZ({
                attributions: ' ',
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            })
        });
        
        const satelliteLayer = new ol.layer.Tile({
            title: 'Google Satellite',
            opacity: 1.0,
            visible: true,
            source: new ol.source.XYZ({
                attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            })
        });
        
        const esriLayer = new ol.layer.Tile({
            title: 'Esri World Imagery',
            opacity: 1.0,
            visible: false,
            source: new ol.source.XYZ({
                attributions: 'Tiles © Esri',
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            })
        });
        
        const referenceLayer = new ol.layer.Tile({
            title: 'Reference Layer',
            opacity: 1.0,
            visible: false,
            source: new ol.source.XYZ({
                attributions: 'Tiles © Esri',
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
            })
        });
        
        // Create map
        this.map = new ol.Map({
            target: 'map',
            layers: [
                new ol.layer.Group({
                    title: 'Base Maps',
                    layers: [satelliteLayer, esriLayer, osmLayer, referenceLayer]
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([-76.5, 40.0]),
                zoom: 10,
                maxZoom: 20,
                minZoom: 5
            })
        });
        
        // Add layer switcher
        const layerSwitcher = new ol.control.LayerSwitcher({
            tipLabel: 'Layers',
            reverse: true,
            groupSelectStyle: 'group'
        });
        this.map.addControl(layerSwitcher);
    },
    
    /**
     * Create data layers from uploaded GeoJSON
     */
    createLayers: function() {
        const format = new ol.format.GeoJSON();
        
        // Watershed boundary layer (bottom)
        if (BuilderState.watershedData) {
            const watershedFeatures = format.readFeatures(BuilderState.watershedData, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            
            const watershedSource = new ol.source.Vector({ features: watershedFeatures });
            
            this.watershedLayer = new ol.layer.Vector({
                title: 'Watershed Boundary',
                source: watershedSource,
                style: this.getWatershedStyle(),
                zIndex: 1
            });
            
            // Fit view to watershed extent and save it
            const extent = watershedSource.getExtent();
            this.initialExtent = extent;
            this.map.getView().fit(extent, { padding: [50, 50, 50, 50] });
        }
        
        // Municipality layer
        if (BuilderState.municipalityData && BuilderState.municipalityData.features.length > 0) {
            const municipalityFeatures = format.readFeatures(BuilderState.municipalityData, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            
            const municipalitySource = new ol.source.Vector({ features: municipalityFeatures });
            
            this.municipalityLayer = new ol.layer.Vector({
                title: 'Municipalities',
                source: municipalitySource,
                style: this.getMunicipalityStyle(),
                zIndex: 2
            });
        }
        
        // Parcel layer
        if (BuilderState.parcelData && BuilderState.parcelData.features.length > 0) {
            const parcelFeatures = format.readFeatures(BuilderState.parcelData, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            
            const parcelSource = new ol.source.Vector({ features: parcelFeatures });
            
            this.parcelLayer = new ol.layer.Vector({
                title: 'Parcels',
                source: parcelSource,
                style: this.getParcelStyle(),
                visible: false,
                zIndex: 2.5
            });
            
            // Create highlight layer for selected parcel (always visible)
            this.parcelHighlightLayer = new ol.layer.Vector({
                title: 'Parcel Highlight',
                source: new ol.source.Vector(),
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: '#FFD700',
                        width: 3
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 0, 0.35)'
                    })
                }),
                zIndex: 9
            });
        }
        
        // Streams layer (middle)
        if (BuilderState.streamsData) {
            const streamsFeatures = format.readFeatures(BuilderState.streamsData, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            
            const streamsSource = new ol.source.Vector({ features: streamsFeatures });
            
            this.streamsLayer = new ol.layer.Vector({
                title: 'Streams',
                source: streamsSource,
                style: this.getStreamsStyle.bind(this),
                zIndex: 3
            });
        }
        
        // Project points layer (top)
        if (BuilderState.projectsData) {
            const projectFeatures = format.readFeatures(BuilderState.projectsData, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            
            const projectSource = new ol.source.Vector({ features: projectFeatures });
            
            this.projectLayer = new ol.layer.Vector({
                title: 'Project Points',
                source: projectSource,
                style: this.getProjectStyle.bind(this),
                zIndex: 10
            });
        }
        
        // Build watershed group layers array (order determines layer switcher display with reverse)
        const watershedLayers = [];
        if (this.streamsLayer) watershedLayers.push(this.streamsLayer);
        if (this.watershedLayer) watershedLayers.push(this.watershedLayer);
        if (this.municipalityLayer) watershedLayers.push(this.municipalityLayer);
        if (this.parcelLayer) watershedLayers.push(this.parcelLayer);
        if (this.parcelHighlightLayer) watershedLayers.push(this.parcelHighlightLayer);
        if (this.projectLayer) watershedLayers.push(this.projectLayer);
        
        // Create watershed group
        const watershedGroup = new ol.layer.Group({
            title: 'Watershed Data',
            fold: 'open',
            layers: watershedLayers
        });
        
        this.map.addLayer(watershedGroup);
    },
    
    /**
     * Get watershed style
     */
    getWatershedStyle: function() {
        const sym = BuilderState.symbology.watershed;
        const lineDash = sym.lineDash === 'dashed' ? [8, 8] : 
                         sym.lineDash === 'dotted' ? [2, 4] : undefined;
        
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: sym.strokeColor,
                width: sym.strokeWidth,
                lineDash: lineDash
            }),
            fill: new ol.style.Fill({
                color: sym.fillColor
            })
        });
    },
    
    /**
     * Get streams style (supports plain color or color-by-field)
     */
    getStreamsStyle: function(feature, resolution) {
        const sym = BuilderState.symbology.streams;
        const lineDash = sym.lineDash === 'dashed' ? [8, 8] : 
                         sym.lineDash === 'dotted' ? [2, 4] : undefined;
        
        let strokeColor = sym.strokeColor;
        
        // Check if color-by-field mode
        if (sym.mode === 'byField' && sym.colorField && sym.colorMap) {
            let value = feature.get(sym.colorField);
            if (value === null || value === undefined || value === '') {
                value = '(Null/Empty)';
            } else {
                value = String(value);
            }
            strokeColor = sym.colorMap[value] || sym.strokeColor;
        }
        
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: strokeColor,
                width: sym.strokeWidth,
                lineDash: lineDash
            })
        });
    },
    
    /**
     * Get municipality style
     */
    getMunicipalityStyle: function() {
        const sym = BuilderState.symbology.municipalities;
        const lineDash = sym.lineDash === 'dashed' ? [4, 4] : 
                         sym.lineDash === 'dotted' ? [2, 4] : undefined;
        
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: sym.strokeColor,
                width: sym.strokeWidth,
                lineDash: lineDash
            }),
            fill: new ol.style.Fill({
                color: sym.fillColor
            })
        });
    },
    
    /**
     * Get parcel style
     */
    getParcelStyle: function() {
        const sym = BuilderState.symbology.parcels;
        const lineDash = sym.lineDash === 'dashed' ? [4, 4] : 
                         sym.lineDash === 'dotted' ? [2, 4] : undefined;
        
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: sym.strokeColor,
                width: sym.strokeWidth,
                lineDash: lineDash
            }),
            fill: new ol.style.Fill({
                color: sym.fillColor
            })
        });
    },
    
    /**
     * Get project point style
     */
    getProjectStyle: function(feature, resolution) {
        // Check if feature is filtered out
        if (feature.get('_hidden')) {
            return null;
        }
        
        const sym = BuilderState.symbology.points;
        
        // Dynamic radius based on zoom, scaled by user setting
        const baseRadius = sym.radius || 6;
        let radius = baseRadius;
        if (resolution < 5) {
            radius = baseRadius + 4;
        } else if (resolution < 20) {
            radius = baseRadius + 2;
        } else if (resolution < 50) {
            radius = baseRadius + 1;
        }
        
        // Determine color based on mode
        let color;
        if (sym.mode === 'plain') {
            color = sym.plainColor;
        } else {
            // Color by field - handle null, undefined, empty strings
            let fieldValue = feature.get(sym.colorField);
            
            // Debug: Check what properties are available (only log once)
            if (!this._debugLogged) {
                console.log('Preview Mode - Looking for field:', sym.colorField);
                console.log('Feature properties:', feature.getProperties());
                console.log('Field value:', fieldValue);
                this._debugLogged = true;
            }
            
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
                fieldValue = '(Null/Empty)';
            } else {
                fieldValue = String(fieldValue);
            }
            color = sym.colorMap[fieldValue] || this.getProjectTypeColor(fieldValue);
        }
        
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({
                    color: sym.strokeColor || '#333',
                    width: sym.strokeWidth || 1.5
                })
            })
        });
    },
    
    /**
     * Get color for project type (fallback)
     */
    getProjectTypeColor: function(type) {
        // Generate consistent color based on type string
        if (type && type !== '' && type !== 'Unknown') {
            let hash = 0;
            for (let i = 0; i < type.length; i++) {
                hash = type.charCodeAt(i) + ((hash << 5) - hash);
            }
            const h = Math.abs(hash % 360);
            return `hsl(${h}, 60%, 50%)`;
        }
        
        return '#5a9fd4';
    },
    
    /**
     * Update layer style dynamically
     */
    updateLayerStyle: function(layerName) {
        switch(layerName) {
            case 'watershed':
                if (this.watershedLayer) {
                    this.watershedLayer.setStyle(this.getWatershedStyle());
                }
                break;
            case 'streams':
                if (this.streamsLayer) {
                    this.streamsLayer.setStyle(this.getStreamsStyle.bind(this));
                }
                break;
            case 'municipalities':
                if (this.municipalityLayer) {
                    this.municipalityLayer.setStyle(this.getMunicipalityStyle());
                }
                break;
            case 'parcels':
                if (this.parcelLayer) {
                    this.parcelLayer.setStyle(this.getParcelStyle());
                }
                break;
            case 'points':
                if (this.projectLayer) {
                    this.projectLayer.setStyle(this.getProjectStyle.bind(this));
                }
                break;
        }
    },
    
    /**
     * Initialize popup
     */
    initPopup: function() {
        const container = document.getElementById('popup');
        const content = document.getElementById('popup-content');
        const closer = document.getElementById('popup-closer');
        
        this.popup = new ol.Overlay({
            element: container,
            autoPan: true,
            autoPanAnimation: { duration: 250 }
        });
        
        this.map.addOverlay(this.popup);
        
        // Close popup handler
        closer.onclick = () => {
            this.popup.setPosition(undefined);
            this.clearParcelHighlight();
            closer.blur();
            return false;
        };
        
        // Click handler
        this.map.on('singleclick', (evt) => {
            const feature = this.map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
                // Only return features from project layer
                if (layer === this.projectLayer) {
                    return feature;
                }
            }.bind(this));
            
            if (feature && !feature.get('_hidden')) {
                this.showPopup(feature, evt.coordinate);
                this.highlightParcelAtPoint(feature);
            } else {
                this.popup.setPosition(undefined);
                this.clearParcelHighlight();
            }
        });
        
        // Pointer cursor on hover
        this.map.on('pointermove', (evt) => {
            if (evt.dragging) return;
            
            const hit = this.map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
                return layer === this.projectLayer && !feature.get('_hidden');
            }.bind(this));
            
            this.map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        });
    },
    
    /**
     * Show popup for feature
     */
    showPopup: function(feature, coordinate) {
        const props = feature.getProperties();
        const content = document.getElementById('popup-content');
        
        let html = `<h4>${props.Project_Type || 'Project'}</h4>`;
        
        const fields = [
            { key: 'Landowner', label: 'Landowner' },
            { key: 'Address', label: 'Address' },
            { key: 'Project_Description', label: 'Description' },
            { key: 'Notes', label: 'Notes' },
            { key: 'Municipality', label: 'Municipality' },
            { key: 'Watershed_Name', label: 'Watershed' }
        ];
        
        fields.forEach(field => {
            if (props[field.key] && props[field.key] !== '') {
                html += `<div class="popup-row"><span class="popup-label">${field.label}:</span> ${props[field.key]}</div>`;
            }
        });
        
        content.innerHTML = html;
        this.popup.setPosition(coordinate);
    },
    
    /**
     * Highlight the parcel that intersects the selected point
     */
    highlightParcelAtPoint: function(pointFeature) {
        // Clear any existing highlight
        this.clearParcelHighlight();
        
        // Check if we have parcel data and highlight layer
        if (!this.parcelHighlightLayer || !BuilderState.parcelData || !BuilderState.parcelData.features.length) {
            return;
        }
        
        // Get the point geometry in 4326 for turf
        const pointGeom = pointFeature.getGeometry();
        const coords3857 = pointGeom.getCoordinates();
        const coords4326 = ol.proj.transform(coords3857, 'EPSG:3857', 'EPSG:4326');
        
        // Create turf point
        const turfPoint = turf.point(coords4326);
        
        // Find intersecting parcel
        let intersectingParcel = null;
        for (const parcel of BuilderState.parcelData.features) {
            try {
                if (parcel.geometry && parcel.geometry.type) {
                    if (turf.booleanPointInPolygon(turfPoint, parcel)) {
                        intersectingParcel = parcel;
                        break;
                    }
                }
            } catch (e) {
                // Skip invalid geometries
            }
        }
        
        if (intersectingParcel) {
            // Convert to OpenLayers feature and add to highlight layer
            const format = new ol.format.GeoJSON();
            const highlightFeature = format.readFeature(intersectingParcel, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            
            this.parcelHighlightLayer.getSource().addFeature(highlightFeature);
            this.highlightedParcelFeature = highlightFeature;
        }
    },
    
    /**
     * Clear the parcel highlight
     */
    clearParcelHighlight: function() {
        if (this.parcelHighlightLayer) {
            this.parcelHighlightLayer.getSource().clear();
        }
        this.highlightedParcelFeature = null;
    },
    
    /**
     * Initialize filters
     */
    initFilters: function() {
        // Populate checkbox groups
        this.populateCheckboxGroup('filter-project-type', 'Project_Type');
        this.populateCheckboxGroup('filter-municipality', 'Municipality');
        this.populateCheckboxGroup('filter-watershed', 'Watershed_Name');
        
        // Hide municipality filter if not mapped
        this.hideUnmappedFilters();
        
        // Setup collapsible labels
        this.initCollapsibleLabels();
        
        // Initialize landowner search with autocomplete
        this.initLandownerSearch();
        
        // Clear all filters button
        document.getElementById('clear-all-filters-btn').addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Zoom to filtered button
        document.getElementById('zoom-to-filtered-btn').addEventListener('click', () => {
            this.zoomToFiltered();
        });
        
        // Sidebar close button
        const closeBtn = document.getElementById('utility-bar-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('utility-bar').classList.add('collapsed');
                document.getElementById('sidebar-controls').classList.remove('sidebar-open');
                document.getElementById('feature-counter').classList.remove('sidebar-open');
            });
        }
    },
    
    /**
     * Hide filter sections if their corresponding fields are not mapped
     */
    hideUnmappedFilters: function() {
        // Get the filter group elements
        const municipalityGroup = document.querySelector('[data-target="filter-municipality"]');
        const watershedGroup = document.querySelector('[data-target="filter-watershed"]');
        
        // Check if municipality is mapped
        const municipalityMapped = BuilderState.fieldMappings && 
                                   BuilderState.fieldMappings.Municipality && 
                                   BuilderState.fieldMappings.Municipality !== '';
        
        // Check if watershed is mapped
        const watershedMapped = BuilderState.fieldMappings && 
                                BuilderState.fieldMappings.Watershed_Name && 
                                BuilderState.fieldMappings.Watershed_Name !== '';
        
        // Hide municipality filter if not mapped
        if (municipalityGroup && !municipalityMapped) {
            const filterGroup = municipalityGroup.closest('.filter-group');
            if (filterGroup) {
                filterGroup.style.display = 'none';
            }
        }
        
        // Hide watershed filter if not mapped
        if (watershedGroup && !watershedMapped) {
            const filterGroup = watershedGroup.closest('.filter-group');
            if (filterGroup) {
                filterGroup.style.display = 'none';
            }
        }
    },
    
    /**
     * Initialize landowner search with autocomplete
     */
    initLandownerSearch: function() {
        const searchInput = document.getElementById('filter-search');
        if (!searchInput) return;
        
        // Create autocomplete results container
        const container = searchInput.parentElement;
        container.classList.add('landowner-search-container');
        
        let resultsDiv = document.getElementById('landowner-search-results');
        if (!resultsDiv) {
            resultsDiv = document.createElement('div');
            resultsDiv.id = 'landowner-search-results';
            resultsDiv.className = 'landowner-search-results';
            container.appendChild(resultsDiv);
        }
        
        // Debounce function
        let debounceTimer;
        const debounce = (func, delay) => {
            return (...args) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => func.apply(this, args), delay);
            };
        };
        
        // Search handler
        const handleSearch = debounce((searchText) => {
            if (searchText.length < 2) {
                resultsDiv.classList.remove('visible');
                resultsDiv.innerHTML = '';
                this.activeFilters.search = '';
                this.applyFilters();
                return;
            }
            
            const results = this.searchLandowners(searchText);
            this.displaySearchResults(results, resultsDiv, searchInput);
        }, 200);
        
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value.trim());
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                resultsDiv.classList.remove('visible');
            }
        });
        
        // Show results on focus if there's text
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2 && resultsDiv.innerHTML) {
                resultsDiv.classList.add('visible');
            }
        });
    },
    
    /**
     * Search for landowners in points and parcels
     */
    searchLandowners: function(searchText) {
        const results = [];
        const lowerSearch = searchText.toLowerCase();
        
        // Search project points
        if (this.projectLayer) {
            this.projectLayer.getSource().getFeatures().forEach(feature => {
                const landowner = feature.get('Landowner') || '';
                if (landowner.toLowerCase().includes(lowerSearch)) {
                    const similarity = this.calculateSimilarity(lowerSearch, landowner.toLowerCase());
                    results.push({
                        name: landowner,
                        source: 'Project',
                        detail: feature.get('Address') || feature.get('Project_Type') || '',
                        feature: feature,
                        type: 'point',
                        similarity: similarity
                    });
                }
            });
        }
        
        // Search parcels if available
        if (BuilderState.parcelData && BuilderState.parcelData.features) {
            // Try common landowner field names
            const landownerFields = ['OWNER', 'OWNER_NAME', 'OWNERNAME', 'LANDOWNER', 'NAME', 'OWNER1', 'PROP_OWNER'];
            
            BuilderState.parcelData.features.forEach(parcel => {
                const props = parcel.properties || {};
                
                // Find the landowner field
                let ownerValue = null;
                let ownerField = null;
                for (const field of landownerFields) {
                    if (props[field]) {
                        ownerValue = props[field];
                        ownerField = field;
                        break;
                    }
                }
                
                // Also try case-insensitive search
                if (!ownerValue) {
                    for (const key of Object.keys(props)) {
                        if (key.toLowerCase().includes('owner') || key.toLowerCase().includes('name')) {
                            if (props[key] && typeof props[key] === 'string') {
                                ownerValue = props[key];
                                ownerField = key;
                                break;
                            }
                        }
                    }
                }
                
                if (ownerValue && ownerValue.toLowerCase().includes(lowerSearch)) {
                    const similarity = this.calculateSimilarity(lowerSearch, ownerValue.toLowerCase());
                    results.push({
                        name: ownerValue,
                        source: 'Parcel',
                        detail: props['ADDRESS'] || props['SITE_ADDR'] || props['ADDR'] || '',
                        parcel: parcel,
                        type: 'parcel',
                        similarity: similarity
                    });
                }
            });
        }
        
        // Sort by similarity (higher = better match) and return top 5
        results.sort((a, b) => b.similarity - a.similarity);
        
        // Remove duplicates by name
        const seen = new Set();
        const unique = results.filter(r => {
            const key = r.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        return unique.slice(0, 5);
    },
    
    /**
     * Calculate similarity score for sorting results
     */
    calculateSimilarity: function(search, target) {
        // Starts with gets highest score
        if (target.startsWith(search)) return 3;
        // Word boundary match
        if (target.includes(' ' + search) || target.includes(search + ' ')) return 2;
        // Contains anywhere
        if (target.includes(search)) return 1;
        return 0;
    },
    
    /**
     * Display search results dropdown
     */
    displaySearchResults: function(results, resultsDiv, searchInput) {
        if (results.length === 0) {
            resultsDiv.classList.remove('visible');
            resultsDiv.innerHTML = '';
            return;
        }
        
        let html = '';
        results.forEach((result, index) => {
            html += `<div class="landowner-result-item" data-index="${index}">
                <span class="result-name">${this.escapeHtml(result.name)}</span>
                <span class="result-source">(${result.source})</span>
                ${result.detail ? `<div class="result-detail">${this.escapeHtml(result.detail)}</div>` : ''}
            </div>`;
        });
        
        resultsDiv.innerHTML = html;
        resultsDiv.classList.add('visible');
        
        // Add click handlers
        resultsDiv.querySelectorAll('.landowner-result-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                const result = results[index];
                searchInput.value = result.name;
                resultsDiv.classList.remove('visible');
                
                // Apply the search filter
                this.activeFilters.search = result.name.toLowerCase();
                this.applyFilters();
                
                // Zoom to and highlight the feature
                if (result.type === 'point' && result.feature) {
                    const extent = result.feature.getGeometry().getExtent();
                    this.map.getView().fit(extent, { maxZoom: 17, padding: [100, 100, 100, 100] });
                    this.showPopup(result.feature, result.feature.getGeometry().getCoordinates());
                    this.highlightParcelAtPoint(result.feature);
                } else if (result.type === 'parcel' && result.parcel) {
                    // Highlight the parcel
                    this.highlightParcelFromGeoJSON(result.parcel);
                }
            });
        });
    },
    
    /**
     * Highlight a parcel from GeoJSON
     */
    highlightParcelFromGeoJSON: function(parcel) {
        this.clearParcelHighlight();
        
        if (!this.parcelHighlightLayer || !parcel) return;
        
        const format = new ol.format.GeoJSON();
        const highlightFeature = format.readFeature(parcel, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        
        this.parcelHighlightLayer.getSource().addFeature(highlightFeature);
        this.highlightedParcelFeature = highlightFeature;
        
        // Zoom to parcel
        const extent = highlightFeature.getGeometry().getExtent();
        this.map.getView().fit(extent, { maxZoom: 17, padding: [100, 100, 100, 100] });
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Initialize collapsible labels
     */
    initCollapsibleLabels: function() {
        const labels = document.querySelectorAll('.collapsible-label');
        labels.forEach(label => {
            label.addEventListener('click', () => {
                const targetId = label.getAttribute('data-target');
                const target = document.getElementById(targetId);
                const icon = label.querySelector('.collapse-icon');
                
                if (target) {
                    target.classList.toggle('collapsed');
                }
                if (icon) {
                    icon.classList.toggle('collapsed');
                }
            });
        });
    },
    
    /**
     * Populate checkbox group with unique values
     */
    populateCheckboxGroup: function(groupId, fieldName) {
        const group = document.getElementById(groupId);
        if (!group || !this.projectLayer) return;
        
        const values = new Set();
        this.projectLayer.getSource().getFeatures().forEach(feature => {
            const val = feature.get(fieldName);
            if (val && val !== '') {
                values.add(val);
            }
        });
        
        const sortedValues = Array.from(values).sort();
        group.innerHTML = ''; // Clear existing
        
        sortedValues.forEach(val => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = val;
            checkbox.addEventListener('change', () => {
                this.updateFilterFromCheckboxes(groupId, fieldName);
            });
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' ' + val));
            group.appendChild(label);
        });
    },
    
    /**
     * Update filter from checkbox selections
     */
    updateFilterFromCheckboxes: function(groupId, fieldName) {
        const group = document.getElementById(groupId);
        const checkboxes = group.querySelectorAll('input[type="checkbox"]:checked');
        const values = Array.from(checkboxes).map(cb => cb.value);
        
        // Map to activeFilters key
        if (fieldName === 'Project_Type') {
            this.activeFilters.projectTypes = values;
        } else if (fieldName === 'Municipality') {
            this.activeFilters.municipalities = values;
        } else if (fieldName === 'Watershed_Name') {
            this.activeFilters.watersheds = values;
        }
        
        this.applyFilters();
    },
    
    /**
     * Apply filters to project layer
     */
    applyFilters: function() {
        if (!this.projectLayer) return;
        
        const features = this.projectLayer.getSource().getFeatures();
        
        features.forEach(feature => {
            let visible = true;
            
            // Project type filter (multiple selection)
            if (this.activeFilters.projectTypes && this.activeFilters.projectTypes.length > 0) {
                const featureType = feature.get('Project_Type');
                if (!this.activeFilters.projectTypes.includes(featureType)) {
                    visible = false;
                }
            }
            
            // Municipality filter (multiple selection)
            if (visible && this.activeFilters.municipalities && this.activeFilters.municipalities.length > 0) {
                const featureMuni = feature.get('Municipality');
                if (!this.activeFilters.municipalities.includes(featureMuni)) {
                    visible = false;
                }
            }
            
            // Watershed filter (multiple selection)
            if (visible && this.activeFilters.watersheds && this.activeFilters.watersheds.length > 0) {
                const featureWatershed = feature.get('Watershed_Name');
                if (!this.activeFilters.watersheds.includes(featureWatershed)) {
                    visible = false;
                }
            }
            
            // Search filter
            if (visible && this.activeFilters.search) {
                const searchText = this.activeFilters.search;
                const landowner = (feature.get('Landowner') || '').toLowerCase();
                const address = (feature.get('Address') || '').toLowerCase();
                const description = (feature.get('Project_Description') || '').toLowerCase();
                const notes = (feature.get('Notes') || '').toLowerCase();
                
                if (!landowner.includes(searchText) && 
                    !address.includes(searchText) && 
                    !description.includes(searchText) &&
                    !notes.includes(searchText)) {
                    visible = false;
                }
            }
            
            feature.set('_hidden', !visible);
        });
        
        // Refresh layer
        this.projectLayer.changed();
        this.updateFeatureCounter();
    },
    
    /**
     * Clear all filters
     */
    clearFilters: function() {
        this.activeFilters = {
            projectTypes: [],
            municipalities: [],
            watersheds: [],
            search: ''
        };
        
        // Reset all checkboxes
        const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        
        // Reset search and hide autocomplete results
        document.getElementById('filter-search').value = '';
        const resultsDiv = document.getElementById('landowner-search-results');
        if (resultsDiv) {
            resultsDiv.classList.remove('visible');
            resultsDiv.innerHTML = '';
        }
        
        // Show all features
        if (this.projectLayer) {
            this.projectLayer.getSource().getFeatures().forEach(feature => {
                feature.set('_hidden', false);
            });
            this.projectLayer.changed();
        }
        
        this.updateFeatureCounter();
    },
    
    /**
     * Zoom to filtered features
     */
    zoomToFiltered: function() {
        if (!this.projectLayer) return;
        
        const visibleFeatures = this.projectLayer.getSource().getFeatures()
            .filter(f => !f.get('_hidden'));
        
        if (visibleFeatures.length === 0) {
            alert('No visible features to zoom to.');
            return;
        }
        
        const extent = ol.extent.createEmpty();
        visibleFeatures.forEach(feature => {
            ol.extent.extend(extent, feature.getGeometry().getExtent());
        });
        
        this.map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 16
        });
    },
    
    /**
     * Update feature counter
     */
    updateFeatureCounter: function() {
        if (!this.projectLayer) return;
        
        const total = this.projectLayer.getSource().getFeatures().length;
        const visible = this.projectLayer.getSource().getFeatures()
            .filter(f => !f.get('_hidden')).length;
        
        const counterEl = document.getElementById('project-counter');
        if (counterEl) {
            counterEl.innerHTML = `
                <span class="count">${visible}</span> of ${total} projects visible
            `;
        }
    },
    
    /**
     * Initialize sidebar toggle
     */
    initSidebarToggle: function() {
        const sidebar = document.getElementById('utility-bar');
        const controls = document.getElementById('sidebar-controls');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const featureCounter = document.getElementById('feature-counter');
        
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            controls.classList.toggle('sidebar-open');
            featureCounter.classList.toggle('sidebar-open');
        });
    },
    
    /**
     * Initialize download button
     */
    initDownloadButton: function() {
        const downloadBtn = document.getElementById('download-data-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.showDownloadModal();
            });
        }
    },
    
    /**
     * Initialize reset extent button
     */
    initResetExtentButton: function() {
        const resetBtn = document.getElementById('reset-extent-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetExtent();
            });
        }
    },
    
    /**
     * Reset map to initial extent
     */
    resetExtent: function() {
        if (this.initialExtent && this.map) {
            this.map.getView().fit(this.initialExtent, {
                padding: [50, 50, 50, 50],
                duration: 500
            });
        }
    },
    
    /**
     * Show download modal
     */
    showDownloadModal: function() {
        const modal = document.getElementById('download-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        
        // Setup modal handlers
        this.setupDownloadModalHandlers();
    },
    
    /**
     * Setup download modal handlers
     */
    setupDownloadModalHandlers: function() {
        const modal = document.getElementById('download-modal');
        const cancelBtn = document.getElementById('download-cancel-btn');
        const confirmBtn = document.getElementById('download-confirm-btn');
        const closeBtn = modal.querySelector('.modal-close');
        
        const closeModal = () => {
            modal.classList.add('hidden');
        };
        
        if (cancelBtn) cancelBtn.onclick = closeModal;
        if (closeBtn) closeBtn.onclick = closeModal;
        
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                this.downloadFilteredData();
                closeModal();
            };
        }
    },
    
    /**
     * Download filtered data
     */
    downloadFilteredData: function() {
        if (!this.projectLayer) return;
        
        const filename = document.getElementById('download-filename').value || 'filtered_projects';
        const format = document.getElementById('download-format').value || 'geojson';
        
        // Get visible features
        const visibleFeatures = this.projectLayer.getSource().getFeatures()
            .filter(f => !f.get('_hidden'));
        
        if (visibleFeatures.length === 0) {
            alert('No visible features to download.');
            return;
        }
        
        if (format === 'geojson') {
            this.downloadAsGeoJSON(visibleFeatures, filename);
        } else if (format === 'csv') {
            this.downloadAsCSV(visibleFeatures, filename);
        } else if (format === 'xlsx') {
            this.downloadAsExcel(visibleFeatures, filename);
        }
    },
    
    /**
     * Download as GeoJSON
     */
    downloadAsGeoJSON: function(features, filename) {
        const geoJSONFormat = new ol.format.GeoJSON();
        const featureCollection = {
            type: 'FeatureCollection',
            features: features.map(f => {
                const clone = f.clone();
                clone.unset('_hidden');
                const geojson = JSON.parse(geoJSONFormat.writeFeature(clone, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                }));
                return geojson;
            })
        };
        
        const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, filename + '.geojson');
    },
    
    /**
     * Download as CSV
     */
    downloadAsCSV: function(features, filename) {
        const headers = ['Project_Type', 'Landowner', 'Address', 'Project_Description', 'Notes', 'Municipality', 'Watershed_Name', 'Longitude', 'Latitude'];
        let csv = headers.join(',') + '\n';
        
        features.forEach(f => {
            const props = f.getProperties();
            const geom = f.getGeometry();
            let lon = '', lat = '';
            
            if (geom) {
                const coords = ol.proj.transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
                lon = coords[0].toFixed(6);
                lat = coords[1].toFixed(6);
            }
            
            const row = headers.slice(0, 7).map(h => {
                const val = props[h] || '';
                // Escape quotes and wrap in quotes if contains comma
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                    return '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            row.push(lon, lat);
            csv += row.join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadBlob(blob, filename + '.csv');
    },
    
    /**
     * Download as Excel
     */
    downloadAsExcel: function(features, filename) {
        if (typeof XLSX === 'undefined') {
            alert('Excel export not available. Please use CSV or GeoJSON format.');
            return;
        }
        
        const headers = ['Project_Type', 'Landowner', 'Address', 'Project_Description', 'Notes', 'Municipality', 'Watershed_Name', 'Longitude', 'Latitude'];
        const data = [headers];
        
        features.forEach(f => {
            const props = f.getProperties();
            const geom = f.getGeometry();
            let lon = '', lat = '';
            
            if (geom) {
                const coords = ol.proj.transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
                lon = coords[0].toFixed(6);
                lat = coords[1].toFixed(6);
            }
            
            const row = headers.slice(0, 7).map(h => props[h] || '');
            row.push(lon, lat);
            data.push(row);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Projects');
        XLSX.writeFile(wb, filename + '.xlsx');
    },
    
    /**
     * Download blob as file
     */
    downloadBlob: function(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Cleanup when leaving preview mode
     */
    cleanup: function() {
        if (this.map) {
            this.map.setTarget(null);
            this.map = null;
        }
        this.projectLayer = null;
        this.streamsLayer = null;
        this.watershedLayer = null;
        this.municipalityLayer = null;
        this.parcelLayer = null;
        this.parcelHighlightLayer = null;
        this.highlightedParcelFeature = null;
        
        // Reset sidebar state
        document.getElementById('utility-bar').classList.add('collapsed');
        document.getElementById('sidebar-toggle').classList.remove('sidebar-open');
        document.getElementById('feature-counter').classList.remove('sidebar-open');
    }
};

// Initialize export button handler
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('export-dashboard-btn').addEventListener('click', function() {
        if (typeof ExportDashboard !== 'undefined') {
            ExportDashboard.showModal();
        }
    });
});
