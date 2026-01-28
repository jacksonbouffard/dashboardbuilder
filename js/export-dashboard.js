/* ===========================================
   Watershed Dashboard Builder - Export Module
   =========================================== */

/**
 * Export Dashboard Module
 */
const ExportDashboard = {
    
    /**
     * Show export modal
     */
    showModal: function() {
        const modal = document.getElementById('export-modal');
        modal.classList.remove('hidden');
        
        // Set default filename
        const filename = document.getElementById('export-filename');
        const title = BuilderState.dashboardConfig.title || 'watershed_dashboard';
        filename.value = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        
        // Bind modal events
        this.bindModalEvents();
    },
    
    /**
     * Hide export modal
     */
    hideModal: function() {
        const modal = document.getElementById('export-modal');
        modal.classList.add('hidden');
        this.hideProgress();
    },
    
    /**
     * Bind modal events
     */
    bindModalEvents: function() {
        const closeBtn = document.getElementById('export-modal-close');
        const cancelBtn = document.getElementById('export-cancel-btn');
        const confirmBtn = document.getElementById('export-confirm-btn');
        const modal = document.getElementById('export-modal');
        
        closeBtn.onclick = () => this.hideModal();
        cancelBtn.onclick = () => this.hideModal();
        confirmBtn.onclick = () => this.startExport();
        
        modal.onclick = (e) => {
            if (e.target === modal) this.hideModal();
        };
    },
    
    /**
     * Show progress bar
     */
    showProgress: function(text) {
        const progress = document.getElementById('export-progress');
        const progressText = document.getElementById('progress-text');
        progress.classList.remove('hidden');
        progressText.textContent = text || 'Preparing files...';
    },
    
    /**
     * Update progress bar
     */
    updateProgress: function(percent, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        progressFill.style.width = `${percent}%`;
        if (text) progressText.textContent = text;
    },
    
    /**
     * Hide progress bar
     */
    hideProgress: function() {
        const progress = document.getElementById('export-progress');
        const progressFill = document.getElementById('progress-fill');
        progress.classList.add('hidden');
        progressFill.style.width = '0%';
    },
    
    /**
     * Start the export process
     */
    startExport: async function() {
        const filename = document.getElementById('export-filename').value.trim();
        if (!filename) {
            alert('Please enter a package name.');
            return;
        }
        
        this.showProgress('Creating dashboard package...');
        
        try {
            const zip = new JSZip();
            
            // Create folder structure
            const dashboard = zip.folder(filename);
            const resources = dashboard.folder('resources');
            const layers = dashboard.folder('layers');
            const styles = dashboard.folder('styles');
            const css = dashboard.folder('css');
            
            this.updateProgress(10, 'Generating layer files...');
            
            // Add layer data files
            layers.file('project_points.js', this.generateLayerJS('project_points', BuilderState.projectsData));
            layers.file('streams.js', this.generateLayerJS('streams', BuilderState.streamsData));
            layers.file('watershed_boundary.js', this.generateLayerJS('watershed_boundary', BuilderState.watershedData));
            
            // Add municipality layer if available
            if (BuilderState.municipalityData && BuilderState.municipalityData.features.length > 0) {
                layers.file('municipalities.js', this.generateLayerJS('municipalities', BuilderState.municipalityData));
            }
            
            // Add parcel layer if available
            if (BuilderState.parcelData && BuilderState.parcelData.features.length > 0) {
                layers.file('parcels.js', this.generateLayerJS('parcels', BuilderState.parcelData));
            }
            
            this.updateProgress(25, 'Creating layer configuration...');
            
            // Add layers.js
            layers.file('layers.js', this.generateLayersConfig());
            
            this.updateProgress(35, 'Adding style files...');
            
            // Add style files
            styles.file('project_points_style.js', this.generateProjectStyle());
            styles.file('streams_style.js', this.generateStreamsStyle());
            styles.file('watershed_boundary_style.js', this.generateWatershedStyle());
            
            // Add municipality style if available
            if (BuilderState.municipalityData && BuilderState.municipalityData.features.length > 0) {
                styles.file('municipalities_style.js', this.generateMunicipalityStyle());
            }
            
            // Add parcel style if available
            if (BuilderState.parcelData && BuilderState.parcelData.features.length > 0) {
                styles.file('parcels_style.js', this.generateParcelStyle());
            }
            
            this.updateProgress(50, 'Creating dashboard HTML...');
            
            // Add main HTML file
            dashboard.file('index.html', this.generateIndexHTML());
            
            this.updateProgress(60, 'Adding CSS files...');
            
            // Check if attribution should be shown
            const showAttributionCheckbox = document.getElementById('show-attribution');
            const showAttribution = showAttributionCheckbox ? showAttributionCheckbox.checked : true;
            
            // Add CSS files
            css.file('dashboard.css', this.generateDashboardCSS(showAttribution));
            
            this.updateProgress(70, 'Adding JavaScript resources...');
            
            // Add main JS file
            resources.file('dashboard.js', this.generateDashboardJS());
            resources.file('functions.js', this.getFunctionsJS());
            
            this.updateProgress(85, 'Fetching external libraries...');
            
            // Add README
            dashboard.file('README.txt', this.generateReadme());
            
            this.updateProgress(95, 'Creating ZIP file...');
            
            // Generate and download ZIP
            const content = await zip.generateAsync({ type: 'blob' });
            
            this.updateProgress(100, 'Download starting...');
            
            // Trigger download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${filename}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
            
            setTimeout(() => {
                this.hideModal();
                alert('Dashboard exported successfully! Extract the ZIP and open index.html in a browser.');
            }, 500);
            
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting dashboard: ' + error.message);
            this.hideProgress();
        }
    },
    
    /**
     * Generate layer JS file content
     */
    generateLayerJS: function(varName, data) {
        return `var json_${varName} = ${JSON.stringify(data, null, 2)};`;
    },
    
    /**
     * Generate layers.js configuration
     */
    generateLayersConfig: function() {
        const hasMunicipalities = BuilderState.municipalityData && BuilderState.municipalityData.features.length > 0;
        const hasParcels = BuilderState.parcelData && BuilderState.parcelData.features.length > 0;
        
        let layersJS = `/* Layers Configuration */

// Register proj4
if (typeof ol.proj.proj4 !== 'undefined' && typeof proj4 !== 'undefined') {
    ol.proj.proj4.register(proj4);
}

var wms_layers = [];

// ========================================
// BASE MAP LAYERS
// ========================================

var lyr_OpenStreetMap = new ol.layer.Tile({
    'title': 'OpenStreetMap',
    'opacity': 1.000000,
    visible: false,
    source: new ol.source.XYZ({
        attributions: ' ',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    })
});

var lyr_GoogleSatellite = new ol.layer.Tile({
    'title': 'Google Satellite',
    'opacity': 1.000000,
    visible: true,
    source: new ol.source.XYZ({
        attributions: ' ',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
    })
});

var lyr_EsriWorldImagery = new ol.layer.Tile({
    'title': 'Esri World Imagery',
    'opacity': 1.000000,
    visible: false,
    source: new ol.source.XYZ({
        attributions: 'Tiles © Esri',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    })
});

var lyr_ReferenceLayer = new ol.layer.Tile({
    'title': 'Reference Layer',
    'opacity': 1.000000,
    visible: false,
    source: new ol.source.XYZ({
        attributions: 'Tiles © Esri',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
    })
});

// ========================================
// DATA LAYERS
// ========================================

// Watershed Boundary Layer
var format_watershed_boundary = new ol.format.GeoJSON();
var features_watershed_boundary = format_watershed_boundary.readFeatures(json_watershed_boundary, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_watershed_boundary = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_watershed_boundary.addFeatures(features_watershed_boundary);
var lyr_watershed_boundary = new ol.layer.Vector({
    declutter: false,
    source: jsonSource_watershed_boundary, 
    style: style_watershed_boundary,
    title: 'Watershed Boundary',
    zIndex: 1
});
`;

        // Add municipalities layer if available
        if (hasMunicipalities) {
            layersJS += `
// Municipalities Layer
var format_municipalities = new ol.format.GeoJSON();
var features_municipalities = format_municipalities.readFeatures(json_municipalities, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_municipalities = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_municipalities.addFeatures(features_municipalities);
var lyr_municipalities = new ol.layer.Vector({
    declutter: false,
    source: jsonSource_municipalities, 
    style: style_municipalities,
    title: 'Municipalities',
    zIndex: 2
});
`;
        }

        // Add parcels layer if available
        if (hasParcels) {
            layersJS += `
// Parcels Layer
var format_parcels = new ol.format.GeoJSON();
var features_parcels = format_parcels.readFeatures(json_parcels, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_parcels = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_parcels.addFeatures(features_parcels);
var lyr_parcels = new ol.layer.Vector({
    declutter: false,
    source: jsonSource_parcels, 
    style: style_parcels,
    title: 'Parcels',
    zIndex: 2.5
});
`;
        }

        layersJS += `
// Streams Layer
var format_streams = new ol.format.GeoJSON();
var features_streams = format_streams.readFeatures(json_streams, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_streams = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_streams.addFeatures(features_streams);
var lyr_streams = new ol.layer.Vector({
    declutter: false,
    source: jsonSource_streams, 
    style: style_streams,
    title: 'Streams',
    zIndex: 3
});

// Project Points Layer
var format_project_points = new ol.format.GeoJSON();
var features_project_points = format_project_points.readFeatures(json_project_points, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_project_points = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_project_points.addFeatures(features_project_points);
var lyr_project_points = new ol.layer.Vector({
    declutter: false,
    source: jsonSource_project_points, 
    style: style_project_points,
    interactive: true,
    title: 'Project Points',
    zIndex: 10
});

// ========================================
// LAYER VISIBILITY
// ========================================

lyr_OpenStreetMap.setVisible(false);
lyr_GoogleSatellite.setVisible(true);
lyr_EsriWorldImagery.setVisible(false);
lyr_ReferenceLayer.setVisible(false);
lyr_watershed_boundary.setVisible(true);
`;

        if (hasMunicipalities) {
            layersJS += `lyr_municipalities.setVisible(true);
`;
        }

        if (hasParcels) {
            layersJS += `lyr_parcels.setVisible(false);
`;
        }

        layersJS += `lyr_streams.setVisible(true);
lyr_project_points.setVisible(true);

// ========================================
// LAYER GROUPS
// ========================================

var basemapGroup = new ol.layer.Group({
    title: 'Base Maps',
    layers: [lyr_GoogleSatellite, lyr_EsriWorldImagery, lyr_OpenStreetMap, lyr_ReferenceLayer]
});
`;

        // Add parcel highlight layer if parcels exist
        if (hasParcels) {
            layersJS += `
// Parcel Highlight Layer (for selected point)
var parcelHighlightSource = new ol.source.Vector();
var lyr_parcel_highlight = new ol.layer.Vector({
    source: parcelHighlightSource,
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
`;
        }

        layersJS += `
var watershedGroup = new ol.layer.Group({
    title: 'Watershed Data',
    fold: 'open',
    layers: [lyr_streams, lyr_watershed_boundary, ${hasMunicipalities ? 'lyr_municipalities, ' : ''}${hasParcels ? 'lyr_parcels, lyr_parcel_highlight, ' : ''}lyr_project_points]
});

var layersList = [basemapGroup, watershedGroup];

// ========================================
// FIELD CONFIGURATION
// ========================================

lyr_project_points.set('fieldAliases', {
    'Project_Type': 'Project Type',
    'Landowner': 'Landowner',
    'Address': 'Address',
    'Project_Description': 'Description',
    'Notes': 'Notes',
    'Municipality': 'Municipality',
    'Watershed_Name': 'Watershed'
});
`;
        return layersJS;
    },
    
    /**
     * Generate project points style
     */
    generateProjectStyle: function() {
        const sym = BuilderState.symbology.points;
        const baseRadius = sym.radius || 6;
        
        if (sym.mode === 'plain') {
            // Plain single color mode
            return `/* Project Points Style - Plain Color */

var style_project_points = function(feature, resolution) {
    // Check if feature is hidden by filter
    if (feature.get('_hidden')) {
        return null;
    }
    
    // Dynamic radius based on zoom
    var baseRadius = ${baseRadius};
    var radius = baseRadius;
    if (resolution < 5) {
        radius = baseRadius + 4;
    } else if (resolution < 20) {
        radius = baseRadius + 2;
    } else if (resolution < 50) {
        radius = baseRadius + 1;
    }
    
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            fill: new ol.style.Fill({ color: '${sym.plainColor}' }),
            stroke: new ol.style.Stroke({
                color: '${sym.strokeColor}',
                width: ${sym.strokeWidth}
            })
        })
    });
};
`;
        } else {
            // Color by field mode
            const colorMapJson = JSON.stringify(sym.colorMap || {});
            return `/* Project Points Style - Color by Field */

var projectColorMap = ${colorMapJson};

var style_project_points = function(feature, resolution) {
    // Check if feature is hidden by filter
    if (feature.get('_hidden')) {
        return null;
    }
    
    // Dynamic radius based on zoom
    var baseRadius = ${baseRadius};
    var radius = baseRadius;
    if (resolution < 5) {
        radius = baseRadius + 4;
    } else if (resolution < 20) {
        radius = baseRadius + 2;
    } else if (resolution < 50) {
        radius = baseRadius + 1;
    }
    
    // Get field value for color
    var fieldValue = feature.get('${sym.colorField}') || 'Unknown';
    var color = projectColorMap[fieldValue] || getProjectTypeColor(fieldValue);
    
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            fill: new ol.style.Fill({ color: color }),
            stroke: new ol.style.Stroke({
                color: '${sym.strokeColor}',
                width: ${sym.strokeWidth}
            })
        })
    });
};

function getProjectTypeColor(type) {
    if (!type || type === '' || type === 'Unknown') {
        return '#5a9fd4';
    }
    
    // Generate consistent color based on type string
    var hash = 0;
    for (var i = 0; i < type.length; i++) {
        hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    var h = Math.abs(hash % 360);
    return 'hsl(' + h + ', 60%, 50%)';
}
`;
        }
    },
    
    /**
     * Generate streams style
     */
    generateStreamsStyle: function() {
        const sym = BuilderState.symbology.streams;
        const lineDash = sym.lineDash === 'dashed' ? '[8, 8]' : 
                         sym.lineDash === 'dotted' ? '[2, 4]' : 'undefined';
        
        // Check if using color-by-field mode
        if (sym.mode === 'byField' && sym.colorField && sym.colorMap && Object.keys(sym.colorMap).length > 0) {
            // Generate color map object
            const colorMapStr = JSON.stringify(sym.colorMap);
            
            return `/* Streams Style - Color by Field */

var streamsColorField = '${sym.colorField}';
var streamsColorMap = ${colorMapStr};
var streamsDefaultColor = '${sym.strokeColor}';
var streamsStrokeWidth = ${sym.strokeWidth};
var streamsLineDash = ${lineDash};

function style_streams_func(feature, resolution) {
    var value = feature.get(streamsColorField);
    if (value === null || value === undefined || value === '') {
        value = '(Null/Empty)';
    } else {
        value = String(value);
    }
    var color = streamsColorMap[value] || streamsDefaultColor;
    
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: color,
            width: streamsStrokeWidth${lineDash !== 'undefined' ? `,
            lineDash: streamsLineDash` : ''}
        })
    });
}

var style_streams = style_streams_func;
`;
        }
        
        // Plain color mode
        return `/* Streams Style */

var style_streams = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '${sym.strokeColor}',
        width: ${sym.strokeWidth}${lineDash !== 'undefined' ? `,
        lineDash: ${lineDash}` : ''}
    })
});
`;
    },
    
    /**
     * Generate watershed boundary style
     */
    generateWatershedStyle: function() {
        const sym = BuilderState.symbology.watershed;
        const lineDash = sym.lineDash === 'dashed' ? '[8, 8]' : 
                         sym.lineDash === 'dotted' ? '[2, 4]' : 'undefined';
        
        return `/* Watershed Boundary Style */

var style_watershed_boundary = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '${sym.strokeColor}',
        width: ${sym.strokeWidth}${lineDash !== 'undefined' ? `,
        lineDash: ${lineDash}` : ''}
    }),
    fill: new ol.style.Fill({
        color: '${sym.fillColor}'
    })
});
`;
    },
    
    /**
     * Generate municipalities style
     */
    generateMunicipalityStyle: function() {
        const sym = BuilderState.symbology.municipalities;
        const lineDash = sym.lineDash === 'dashed' ? '[4, 4]' : 
                         sym.lineDash === 'dotted' ? '[2, 4]' : 'undefined';
        
        return `/* Municipalities Style */

var style_municipalities = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '${sym.strokeColor}',
        width: ${sym.strokeWidth}${lineDash !== 'undefined' ? `,
        lineDash: ${lineDash}` : ''}
    }),
    fill: new ol.style.Fill({
        color: '${sym.fillColor}'
    })
});
`;
    },
    
    /**
     * Generate parcels style
     */
    generateParcelStyle: function() {
        const sym = BuilderState.symbology.parcels;
        const lineDash = sym.lineDash === 'dashed' ? '[4, 4]' : 
                         sym.lineDash === 'dotted' ? '[2, 4]' : 'undefined';
        
        return `/* Parcels Style */

var style_parcels = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '${sym.strokeColor}',
        width: ${sym.strokeWidth}${lineDash !== 'undefined' ? `,
        lineDash: ${lineDash}` : ''}
    }),
    fill: new ol.style.Fill({
        color: '${sym.fillColor}'
    })
});
`;
    },
    
    /**
     * Generate main index.html
     */
    generateIndexHTML: function() {
        const title = BuilderState.dashboardConfig.title || 'Watershed Dashboard';
        const description = BuilderState.dashboardConfig.description || '';
        const hasMunicipalities = BuilderState.municipalityData && BuilderState.municipalityData.features.length > 0;
        const hasParcels = BuilderState.parcelData && BuilderState.parcelData.features.length > 0;
        
        // Check if attribution should be shown
        const showAttributionCheckbox = document.getElementById('show-attribution');
        const showAttribution = showAttributionCheckbox ? showAttributionCheckbox.checked : true;
        
        // Check if municipality and watershed fields are mapped
        const hasMunicipalityField = BuilderState.fieldMappings && 
                                      BuilderState.fieldMappings.Municipality && 
                                      BuilderState.fieldMappings.Municipality !== '';
        const hasWatershedField = BuilderState.fieldMappings && 
                                   BuilderState.fieldMappings.Watershed_Name && 
                                   BuilderState.fieldMappings.Watershed_Name !== '';
        
        // Build municipality script tags conditionally
        const municipalityLayerScript = hasMunicipalities ? '<script src="layers/municipalities.js"></script>\n        ' : '';
        const municipalityStyleScript = hasMunicipalities ? '<script src="styles/municipalities_style.js"></script>\n        ' : '';
        
        // Build parcel script tags conditionally
        const parcelLayerScript = hasParcels ? '<script src="layers/parcels.js"></script>\n        ' : '';
        const parcelStyleScript = hasParcels ? '<script src="styles/parcels_style.js"></script>\n        ' : '';
        
        // Build conditional filter HTML
        const municipalityFilterHTML = hasMunicipalityField ? `
                <div class="filter-group" id="municipality-filter-group">
                    <label class="collapsible-label" data-target="filter-municipality">
                        <span>Municipality:</span>
                        <span class="collapse-icon collapsed">▼</span>
                    </label>
                    <div class="checkbox-group collapsed" id="filter-municipality">
                        <!-- Populated dynamically -->
                    </div>
                </div>` : '';
        
        const watershedFilterHTML = hasWatershedField ? `
                <div class="filter-group" id="watershed-filter-group">
                    <label class="collapsible-label" data-target="filter-watershed">
                        <span>Watershed:</span>
                        <span class="collapse-icon collapsed">▼</span>
                    </label>
                    <div class="checkbox-group collapsed" id="filter-watershed">
                        <!-- Populated dynamically -->
                    </div>
                </div>` : '';
        
        // Build attribution HTML conditionally
        const attributionHTML = showAttribution ? `
        <!-- Attribution Box -->
        <div id="attribution-box" class="attribution-box">
            <button id="attribution-toggle" class="attribution-toggle" title="Toggle attribution">
                <i class="fas fa-info-circle"></i>
            </button>
            <p class="attribution-text">Produced by the Penn State Agriculture and Environment Center | Jackson Bouffard, GIS Technician</p>
        </div>` : '';
        
        return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="initial-scale=1,user-scalable=no,maximum-scale=1,width=device-width">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <title>${title}</title>
        
        <!-- OpenLayers CSS -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css">
        
        <!-- Layer Switcher CSS -->
        <link rel="stylesheet" href="https://unpkg.com/ol-layerswitcher@4.1.1/dist/ol-layerswitcher.css">
        
        <!-- FontAwesome -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        
        <!-- SheetJS for Excel export -->
        <script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"></script>
        
        <!-- Dashboard CSS -->
        <link rel="stylesheet" href="css/dashboard.css">
    </head>
    <body>
        <div id="map">
            <div id="popup" class="ol-popup">
                <a href="#" id="popup-closer" class="ol-popup-closer"></a>
                <div id="popup-content"></div>
            </div>
            
            <!-- Dynamic Map Legend -->
            <div id="map-legend" class="map-legend hidden">
                <div class="map-legend-header">
                    <span class="map-legend-title">Legend</span>
                    <button id="map-legend-close" class="map-legend-close">&times;</button>
                </div>
                <div id="map-legend-content" class="map-legend-content">
                    <!-- Populated dynamically -->
                </div>
            </div>
        </div>
        
        <!-- Feature Counter -->
        <div id="feature-counter">
            <div class="counter-content">
                <div class="counter-title">${title}</div>
                <div id="project-counter" class="counter-row"></div>
                <div class="counter-actions">
                    <button id="download-btn" class="download-btn" title="Download filtered data">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        </div>
        ${attributionHTML}
        
        <!-- Download Modal -->
        <div id="download-modal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Download Project Points</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Download the currently filtered project points.</p>
                    <div class="download-config">
                        <label for="download-filename">File Name:</label>
                        <input type="text" id="download-filename" class="download-input" value="projects">
                    </div>
                    <div class="download-config">
                        <label for="download-format">Format:</label>
                        <select id="download-format" class="download-select">
                            <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
                            <option value="csv">CSV - Comma Separated Values</option>
                            <option value="geojson">GeoJSON - Geographic JSON</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="download-cancel-btn" class="modal-btn cancel-btn">Cancel</button>
                    <button id="download-confirm-btn" class="modal-btn confirm-btn"><i class="fas fa-download"></i> Download</button>
                </div>
            </div>
        </div>
        
        <!-- Filter Sidebar -->
        <div id="utility-bar" class="utility-bar collapsed">
            <div class="utility-bar-header">
                <button id="clear-all-filters-btn" class="clear-all-filters-btn" title="Reset all filters">
                    <i class="fas fa-undo"></i> Clear Filters
                </button>
                <button id="zoom-to-filtered-btn" class="zoom-btn" title="Zoom to filtered features">
                    <i class="fas fa-search-plus"></i> Zoom
                </button>
                <button id="reset-extent-btn" class="reset-extent-btn" title="Reset map to default extent">
                    <i class="fas fa-expand"></i> Reset
                </button>
            </div>
            
            <!-- Close button (lip) -->
            <button id="utility-bar-close" class="utility-bar-close" title="Close sidebar">&times;</button>
            
            <div class="utility-bar-section">
                <h3>Project Filters</h3>
                
                <div class="filter-group">
                    <label class="collapsible-label" data-target="filter-project-type">
                        <span>Project Type:</span>
                        <span class="collapse-icon">▼</span>
                    </label>
                    <div class="checkbox-group" id="filter-project-type">
                        <!-- Populated dynamically -->
                    </div>
                </div>
                ${municipalityFilterHTML}${watershedFilterHTML}
                <div class="filter-group landowner-search-container">
                    <label for="filter-search">Landowner Search:</label>
                    <input type="text" id="filter-search" class="filter-input" placeholder="Search by landowner name...">
                    <div id="landowner-search-results" class="landowner-search-results"></div>
                </div>
            </div>
        </div>
        
        <!-- Sidebar Toggle -->
        <div id="sidebar-controls" class="sidebar-controls">
            <div class="control-btn-wrapper">
                <button id="sidebar-toggle-btn" class="utility-bar-toggle" title="Toggle filters"><i class="fas fa-bars"></i></button>
            </div>
            <div class="control-btn-wrapper">
                <button id="legend-toggle-btn" class="utility-bar-toggle" title="Toggle legend"><i class="fas fa-list-alt"></i></button>
            </div>
        </div>
        
        <!-- Scripts -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.min.js"></script>
        <script>proj4.defs('EPSG:3857','+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs');</script>
        <script src="https://cdn.jsdelivr.net/npm/ol@v7.4.0/dist/ol.js"></script>
        <script src="https://unpkg.com/ol-layerswitcher@4.1.1/dist/ol-layerswitcher.js"></script>
        ${hasParcels ? '<script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js"></script>' : ''}
        
        <!-- Functions -->
        <script src="resources/functions.js"></script>
        
        <!-- Layer Data -->
        <script src="layers/project_points.js"></script>
        <script src="layers/streams.js"></script>
        <script src="layers/watershed_boundary.js"></script>
        ${municipalityLayerScript}${parcelLayerScript}
        <!-- Styles -->
        <script src="styles/project_points_style.js"></script>
        <script src="styles/streams_style.js"></script>
        <script src="styles/watershed_boundary_style.js"></script>
        ${municipalityStyleScript}${parcelStyleScript}
        
        <!-- Layer Configuration -->
        <script src="layers/layers.js"></script>
        
        <!-- Dashboard JS -->
        <script src="resources/dashboard.js"></script>
    </body>
</html>`;
    },
    
    /**
     * Generate dashboard CSS
     */
    generateDashboardCSS: function(showAttribution = true) {
        const featureCounterBottom = showAttribution ? '50px' : '15px';
        return `/* ===========================================
   Watershed Dashboard Styles
   =========================================== */

* {
    box-sizing: border-box;
}

html, body, #map {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    font-family: sans-serif;
    font-size: small;
}

/* ===========================================
   Popup Styles
   =========================================== */

.ol-popup {
    position: absolute;
    background-color: white;
    padding: 15px 20px;
    border-radius: 8px;
    border: 2px solid #0056b3;
    bottom: 12px;
    left: -50%;
    box-shadow: 0 3px 14px rgba(0,0,0,0.15);
    width: 340px;
    max-height: 90vh;
    overflow-y: auto;
    z-index: 100;
}

.ol-popup:after, .ol-popup:before {
    bottom: 100%;
    border: solid transparent;
    content: " ";
    position: absolute;
    left: 50%;
}

.ol-popup:after {
    border-bottom-color: white;
    border-width: 10px;
    margin-left: -10px;
}

.ol-popup:before {
    border-bottom-color: #0056b3;
    border-width: 11px;
    margin-left: -11px;
}

.ol-popup-closer {
    text-decoration: none;
    position: absolute;
    top: 4px;
    right: 4px;
    text-align: center;
    width: 19px;
    color: #999;
    font-family: cursive;
    font-weight: bold;
}

.ol-popup-closer:hover {
    color: #333;
}

.ol-popup-closer:after {
    content: "\\00d7";
}

#popup-content {
    font-size: small;
    line-height: 1.5;
    color: #555;
}

#popup-content h4 {
    margin: 0 0 8px;
    color: #333;
    font-size: 14px;
    font-weight: 600;
    border-bottom: 1px solid #ddd;
    padding-bottom: 6px;
}

#popup-content .popup-row {
    margin: 4px 0;
}

#popup-content .popup-label {
    font-weight: 600;
    color: #333;
}

/* ===========================================
   Feature Counter
   =========================================== */

#feature-counter {
    position: fixed;
    bottom: ${featureCounterBottom};
    left: 15px;
    background: white;
    border-radius: 4px;
    border: 2px solid #0056b3;
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.15);
    padding: 12px;
    min-width: 180px;
    z-index: 1000;
    transition: left 0.3s ease;
}

#feature-counter.sidebar-open {
    left: 330px;
}

/* Attribution Box */
.attribution-box {
    position: fixed;
    bottom: 10px;
    left: 15px;
    background: rgba(248, 249, 250, 0.95);
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 4px 10px;
    z-index: 999;
    transition: left 0.3s ease, padding 0.3s ease;
    display: flex;
    align-items: center;
    gap: 6px;
}

.attribution-box.sidebar-open {
    left: 330px;
}

.attribution-box.collapsed {
    padding: 0;
    background: transparent;
    border: none;
}

.attribution-toggle {
    background: #0056b3;
    color: white;
    border: none;
    border-radius: 3px;
    width: 22px;
    height: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: background 0.2s ease;
    flex-shrink: 0;
}

.attribution-toggle:hover {
    background: #004494;
}

.attribution-text {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    color: #333;
    text-align: center;
    white-space: nowrap;
    transition: opacity 0.3s ease, max-width 0.3s ease;
    overflow: hidden;
}

.attribution-box.collapsed .attribution-text {
    max-width: 0;
    opacity: 0;
    padding: 0;
}

.counter-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.counter-title {
    font-size: 13px;
    font-weight: 600;
    color: #333;
    border-bottom: 1px solid #ddd;
    padding-bottom: 6px;
}

.counter-row {
    font-size: 12px;
    color: #555;
}

.counter-row .count {
    font-weight: 700;
    color: #0056b3;
    font-size: 16px;
}

.counter-actions {
    padding-top: 8px;
    border-top: 1px solid #ddd;
}

.download-btn {
    width: 100%;
    padding: 8px 12px;
    background: #5a9fd4;
    color: white;
    border: 1px solid #4a8fc4;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.download-btn:hover {
    background: #4a8fc4;
}

/* ===========================================
   Modal Styles
   =========================================== */

.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.modal.hidden {
    display: none;
}

.modal-content {
    background: white;
    border-radius: 8px;
    border: 2px solid #0056b3;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #5a9fd4;
    color: white;
    border-radius: 6px 6px 0 0;
}

.modal-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
}

.modal-close {
    background: none;
    border: none;
    font-size: 20px;
    color: white;
    cursor: pointer;
    line-height: 1;
    padding: 0;
}

.modal-body {
    padding: 16px;
}

.modal-body p {
    margin: 0 0 12px;
    color: #555;
    font-size: 12px;
}

.modal-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 12px 16px;
    border-top: 1px solid #ddd;
    background: #f8f9fa;
    border-radius: 0 0 6px 6px;
}

.modal-btn {
    padding: 6px 14px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
}

.cancel-btn {
    background: #6c757d;
    color: white;
    border-color: #5a6268;
}

.confirm-btn {
    background: #5a9fd4;
    color: white;
    border-color: #4a8fc4;
}

.download-config {
    margin-bottom: 10px;
}

.download-config label {
    display: block;
    font-size: 12px;
    color: #333;
    font-weight: 500;
    margin-bottom: 4px;
}

.download-input,
.download-select {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 12px;
}

/* ===========================================
   Filter Sidebar
   =========================================== */

.utility-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 320px;
    background: #f8f9fa;
    border-right: 2px solid #0056b3;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
    z-index: 2000;
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.utility-bar.collapsed {
    transform: translateX(-100%);
}

.utility-bar-header {
    padding: 12px 16px;
    background: #ffffff;
    border-bottom: 2px solid #0056b3;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 10;
    justify-content: space-between;
}

.clear-all-filters-btn,
.zoom-btn,
.reset-extent-btn {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid #4a8fc4;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-family: sans-serif;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.clear-all-filters-btn {
    background-color: #5a9fd4;
    color: white;
}

.clear-all-filters-btn:hover {
    background-color: #4a8fc4;
}

.zoom-btn {
    background-color: #5a9fd4;
    color: white;
}

.zoom-btn:hover {
    background-color: #4a8fc4;
}

.reset-extent-btn {
    background-color: #5a9fd4;
    color: white;
}

.reset-extent-btn:hover {
    background-color: #4a8fc4;
}

.utility-bar-section {
    padding: 18px 16px 12px 16px;
    border-bottom: 1px solid #0056b3;
}

.utility-bar-section h3 {
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
}

.filter-group {
    margin-bottom: 14px;
}

.filter-group label {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: #222;
    margin-bottom: 4px;
}

/* Collapsible Labels */
.collapsible-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    padding: 6px 0;
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
}

.collapse-icon {
    font-size: 11px;
    transition: transform 0.3s ease;
    color: #333;
}

.collapse-icon.collapsed {
    transform: rotate(-90deg);
}

/* Checkbox Groups */
.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
    transition: max-height 0.3s ease, padding 0.3s ease;
}

.checkbox-group.collapsed {
    max-height: 0;
    padding: 0;
    border: none;
    overflow: hidden;
}

.checkbox-group label {
    display: flex;
    align-items: center;
    font-weight: 500;
    font-size: 14px;
    color: #222;
    margin: 0;
    cursor: pointer;
    padding: 4px 2px;
}

.checkbox-group label:hover {
    background: #e8e8e8;
    border-radius: 2px;
}

.checkbox-group input[type="checkbox"] {
    margin-right: 8px;
    cursor: pointer;
    width: 16px;
    height: 16px;
}

.filter-select,
.filter-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 15px;
    background: white;
    color: #1a1a1a;
    font-weight: 500;
}

.filter-select:focus,
.filter-input:focus {
    outline: none;
    border-color: #0056b3;
}

/* Landowner Search Autocomplete */
.landowner-search-container {
    position: relative;
}

.landowner-search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #0056b3;
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    z-index: 100;
    max-height: 250px;
    overflow-y: auto;
    display: none;
}

.landowner-search-results.visible {
    display: block;
}

.landowner-result-item {
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
    font-size: 14px;
    color: #222;
}

.landowner-result-item:last-child {
    border-bottom: none;
}

.landowner-result-item:hover {
    background: #e8f4fc;
}

.landowner-result-item .result-name {
    font-weight: 600;
    color: #1a1a1a;
}

.landowner-result-item .result-source {
    font-size: 11px;
    color: #666;
    margin-left: 8px;
    font-style: italic;
}

.landowner-result-item .result-detail {
    font-size: 12px;
    color: #555;
    margin-top: 2px;
}

/* ===========================================
   Sidebar Close Button (Lip)
   =========================================== */

.utility-bar-close {
    position: fixed;
    top: 75%;
    left: 320px;
    transform: translateY(-50%) translateX(-100px);
    width: 36px;
    height: 50px;
    background: #ffffff;
    color: #333333;
    border-radius: 0 12px 12px 0;
    border: 2px solid #0056b3;
    border-left: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10000;
    font-size: 24px;
    font-weight: bold;
    box-shadow: 3px 0 10px rgba(0,0,0,0.3);
    outline: none;
    transition: width 0.2s ease, box-shadow 0.2s ease;
    pointer-events: auto;
    opacity: 0;
    animation: slideInFromLeft 0.3s ease 0.15s forwards;
}

@keyframes slideInFromLeft {
    from {
        transform: translateY(-50%) translateX(-100px);
        opacity: 0;
    }
    to {
        transform: translateY(-50%) translateX(0);
        opacity: 1;
    }
}

.utility-bar-close:hover {
    background: #ffffff;
    color: #333333;
    width: 42px;
    box-shadow: 4px 0 14px rgba(0,0,0,0.35);
}

.utility-bar.collapsed .utility-bar-close {
    display: none;
}

/* ===========================================
   Sidebar Controls (Toggle)
   =========================================== */

.sidebar-controls {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 1500;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: left 0.3s ease;
}

.sidebar-controls.sidebar-open {
    left: 330px;
}

/* Control button wrapper - matches OL control style */
.control-btn-wrapper {
    background: rgba(255,255,255,0.4) !important;
    padding: 2px !important;
    border: 2px solid #0056b3 !important;
    border-radius: 4px !important;
}

.utility-bar-toggle {
    width: 40px !important;
    height: 40px !important;
    background-color: #f8f8f8 !important;
    color: #444444 !important;
    border: none !important;
    border-radius: 0px !important;
    cursor: pointer !important;
    outline: none !important;
    font-size: 20px !important;
    line-height: 40px !important;
    text-align: center !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    display: block !important;
}

.utility-bar-toggle:hover {
    background-color: rgba(248, 248, 248, 0.7) !important;
}

.utility-bar-toggle.active {
    background-color: #0056b3 !important;
    color: white !important;
}

/* ===========================================
   OpenLayers Control Overrides
   =========================================== */

.ol-control {
    clear: both;
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.4);
}

.ol-zoom {
    background: rgba(255,255,255,0.4) !important;
    padding: 2px !important;
    top: 10px;
    left: auto;
    right: 10px;
    border: 2px solid #0056b3 !important;
    border-radius: 4px !important;
}

.ol-zoom button {
    width: 40px !important;
    height: 40px !important;
    font-size: 20px !important;
    background-color: #f8f8f8 !important;
    color: #444444 !important;
    border: none !important;
    cursor: pointer !important;
    border-radius: 0px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
}

.ol-zoom button:hover {
    background-color: rgba(248, 248, 248, 0.7) !important;
}

.ol-attribution {
    display: none !important;
}

/* ===========================================
   Layer Switcher Override
   =========================================== */

.layer-switcher {
    position: absolute;
    top: 3.5em;
    right: 0.5em;
    text-align: left;
}

.layer-switcher .panel {
    margin: 0;
    border: 2px solid #0056b3;
    border-radius: 4px;
    background-color: rgba(248, 249, 250, 0.9);
    display: none;
    max-height: inherit;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    padding: 12px 8px;
}

/* Layer switcher button - matches zoom control aesthetic */
.layer-switcher button {
    float: right;
    z-index: 1;
    width: 40px;
    height: 40px;
    background-color: #f8f8f8;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23444444' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'%3E%3Cpath d='m1.75 11 6.25 3.25 6.25-3.25m-12.5-3 6.25 3.25 6.25-3.25m-6.25-6.25-6.25 3.25 6.25 3.25 6.25-3.25z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center center;
    background-size: 20px 20px;
    color: transparent;
    border: none;
    border-radius: 0;
    cursor: pointer;
    font-size: 0;
    display: block;
    padding: 0;
    margin: 0;
    line-height: 1;
}

.layer-switcher button:focus,
.layer-switcher button:hover {
    background-color: rgba(248, 248, 248, 0.7);
}

.layer-switcher.shown {
    overflow-y: hidden;
    display: flex;
    flex-direction: column;
    max-height: calc(100% - 5.5em);
}

.layer-switcher.shown.ol-control {
    background-color: transparent;
}

.layer-switcher.shown.ol-control:hover {
    background-color: transparent;
}

.layer-switcher.shown .panel {
    display: block;
    border: 2px solid #0056b3;
}

.layer-switcher.shown > button {
    display: none;
}

.layer-switcher.shown.layer-switcher-activation-mode-click > button {
    display: flex;
    background-color: #f8f8f8;
    background-image: none;
    border: none;
    right: 2px;
    position: absolute;
    margin: 1px;
}

/* Close icon when expanded - handled by JavaScript */

.layer-switcher.shown > button:focus,
.layer-switcher.shown > button:hover {
    background-color: rgba(248, 248, 248, 0.7);
}

.layer-switcher ul {
    list-style: none;
    margin: 1.6em 0.4em;
    padding-left: 0;
}

.layer-switcher ul ul {
    padding-left: 1.2em;
    margin: 0.5em 0 0.5em auto;
    background-color: rgba(255, 255, 255, 1);
    border-radius: 4px;
    padding: 0.5em 0.5em 0.5em 1.5em;
    border: 1px solid #0056b3;
    width: fit-content;
    min-width: 250px;
    margin-left: auto;
    margin-right: 0;
}

.layer-switcher li.group + li.group {
    margin-top: 1em;
    padding-top: 0.8em;
    border-top: 1px solid #0056b3;
}

.layer-switcher li.group {
    position: relative;
    margin-top: 0.5em;
    margin-bottom: 0.3em;
    display: flex;
    align-items: center;
}

.layer-switcher li.group > input {
    position: relative;
    left: 0;
    top: 0;
    height: 1.5em;
    width: 1.5em;
    margin: 0;
    margin-right: 0.5em;
    flex-shrink: 0;
}

.layer-switcher li.group > label {
    font-weight: 600;
    font-size: 18px;
    color: #333;
    text-transform: none;
    letter-spacing: normal;
    padding-bottom: 0;
    padding-left: 0;
    line-height: 1.5em;
    margin: 0;
}

.layer-switcher.layer-switcher-group-select-style-none li.group > label {
    padding-left: 1.2em;
}

.layer-switcher li {
    position: relative;
    margin-top: 0.5em;
    margin-bottom: 0.3em;
}

.layer-switcher li input {
    position: absolute;
    left: 1.2em;
    height: 1.2em;
    width: 1.2em;
    font-size: 1em;
    cursor: pointer;
    accent-color: #0056b3;
    top: 0.1em;
}

.layer-switcher li label {
    padding-left: 2.7em;
    padding-right: 1.2em;
    display: inline-block;
    margin-top: 0px;
    color: #333;
    font-size: 1em;
    font-weight: normal;
    line-height: 1.4;
    cursor: pointer;
    transition: color 0.2s ease;
}

.layer-switcher li label:hover {
    color: #0056b3;
}

.layer-switcher label.disabled {
    opacity: 0.4;
}

.layer-switcher input {
    margin: 0px;
}

.layer-switcher.touch ::-webkit-scrollbar {
    width: 4px;
}

.layer-switcher.touch ::-webkit-scrollbar-track {
    -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
    border-radius: 10px;
}

.layer-switcher.touch ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.5);
}

li.layer-switcher-base-group > label {
    padding-left: 1.2em;
}

.layer-switcher .group button {
    display: none;
}

.layer-switcher .group button:hover {
    opacity: 1;
}

.layer-switcher .group.layer-switcher-close button {
    transform: rotate(-90deg);
    -webkit-transform: rotate(-90deg);
}

.layer-switcher .group.layer-switcher-fold.layer-switcher-close > ul {
    overflow: hidden;
    height: 0;
}

.layer-switcher.shown.layer-switcher-activation-mode-click {
    padding-left: 34px;
}

.layer-switcher.shown.layer-switcher-activation-mode-click > button {
    left: 0;
    border-right: 0;
}

/* Position and wrapper styling to match zoom control */
.ol-control.layer-switcher {
    top: 100px;
    right: 10px;
    z-index: 1000 !important;
    background: rgba(255,255,255,0.4) !important;
    padding: 2px !important;
    border: 2px solid #0056b3 !important;
    border-radius: 4px !important;
}

.ol-control.layer-switcher:hover {
    background: rgba(255,255,255,0.6) !important;
}

.ol-control.layer-switcher .panel {
    z-index: 1001 !important;
}

.layer-switcher.shown {
    z-index: 1000 !important;
    background: transparent !important;
}

.layer-switcher.shown:hover {
    background: transparent !important;
}

.layer-switcher.shown .panel {
    z-index: 1001 !important;
}

/* ===========================================
   Dynamic Map Legend
   =========================================== */

.map-legend {
    position: absolute;
    bottom: 25px;
    right: 25px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.25);
    border: 2px solid #0056b3;
    z-index: 90;
    min-width: 200px;
    max-width: 320px;
    max-height: 400px;
    overflow: hidden;
}

.map-legend.hidden {
    display: none;
}

.map-legend-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #0056b3;
    color: white;
}

.map-legend-title {
    font-weight: 600;
    font-size: 14px;
    color: white;
}

.map-legend-close {
    background: none;
    border: none;
    font-size: 20px;
    color: white;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
}

.map-legend-close:hover {
    opacity: 1;
}

.map-legend-content {
    padding: 12px 14px;
    max-height: 340px;
    overflow-y: auto;
}

.map-legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
    font-size: 13px;
}

.map-legend-item.map-legend-subitem {
    padding-left: 10px;
    font-size: 12px;
}

.map-legend-section-header {
    font-weight: 600;
    font-size: 13px;
    color: #0056b3;
    margin-top: 12px;
    padding-top: 10px;
    padding-bottom: 4px;
    border-top: 2px solid #0056b3;
}

.map-legend-color {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
}

.map-legend-color.map-legend-line {
    width: 24px;
    height: 4px;
    border-radius: 2px;
    border: none;
}

.map-legend-label {
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
}

.map-legend-warning {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    margin: 4px 0;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    font-size: 11px;
    color: #856404;
}

.map-legend-warning i {
    color: #ffc107;
    flex-shrink: 0;
    margin-top: 2px;
}

/* ===========================================
   Responsive Adjustments
   =========================================== */

@media (max-width: 768px) {
    .utility-bar {
        width: 100%;
    }
    
    #feature-counter.sidebar-open {
        left: 15px;
    }
    
    .sidebar-toggle.sidebar-open {
        left: auto;
        right: 10px;
    }
    
    .map-legend {
        bottom: 10px;
        right: 10px;
        max-width: 180px;
    }
}
`;
    },
    
    /**
     * Generate the static legend HTML based on current symbology settings
     */
    generateLegendHTML: function() {
        const sym = BuilderState.symbology;
        let html = '';
        
        // Helper to escape HTML
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        // Watershed Boundary
        if (BuilderState.watershedData) {
            html += '<div class="map-legend-item">';
            html += `<div class="map-legend-color map-legend-line" style="background-color: ${sym.watershed.strokeColor}; border-radius: 0; height: 4px;"></div>`;
            html += '<span class="map-legend-label">Watershed Boundary</span>';
            html += '</div>';
        }
        
        // Streams
        if (BuilderState.streamsData) {
            const streamsSym = sym.streams;
            
            if (streamsSym.mode === 'byField' && streamsSym.colorMap && Object.keys(streamsSym.colorMap).length > 0) {
                // Color by field mode - add section header
                html += '<div class="map-legend-section-header">Streams</div>';
                
                const field = streamsSym.colorField;
                
                // Get sorted values (by count, descending)
                const valueCounts = {};
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
                
                // Check if there are too many values
                if (sortedValues.length > 30) {
                    html += '<div class="map-legend-warning">';
                    html += '<i class="fas fa-exclamation-triangle"></i>';
                    html += `<span>Too many values (${sortedValues.length}) to display</span>`;
                    html += '</div>';
                } else {
                    sortedValues.forEach(([value, count]) => {
                        const color = streamsSym.colorMap[value] || '#999999';
                        html += '<div class="map-legend-item map-legend-subitem">';
                        html += `<div class="map-legend-color map-legend-line" style="background-color: ${color}; border-radius: 0; height: 3px;"></div>`;
                        html += `<span class="map-legend-label">${escapeHtml(value)}</span>`;
                        html += '</div>';
                    });
                }
            } else {
                // Single color mode
                html += '<div class="map-legend-item">';
                html += `<div class="map-legend-color map-legend-line" style="background-color: ${streamsSym.strokeColor}; border-radius: 0; height: 3px;"></div>`;
                html += '<span class="map-legend-label">Streams</span>';
                html += '</div>';
            }
        }
        
        // Municipalities
        if (BuilderState.municipalityData && BuilderState.municipalityData.features.length > 0) {
            const muniSym = sym.municipalities;
            const borderStyle = muniSym.lineDash === 'dashed' ? 'border-style: dashed;' : '';
            html += '<div class="map-legend-item">';
            html += `<div class="map-legend-color map-legend-line" style="background-color: ${muniSym.strokeColor}; border-radius: 0; height: 3px; ${borderStyle}"></div>`;
            html += '<span class="map-legend-label">Municipalities</span>';
            html += '</div>';
        }
        
        // Parcels
        if (BuilderState.parcelData && BuilderState.parcelData.features.length > 0) {
            const parcelSym = sym.parcels;
            const borderStyle = parcelSym.lineDash === 'dashed' ? 'border-style: dashed;' : 
                               parcelSym.lineDash === 'dotted' ? 'border-style: dotted;' : '';
            html += '<div class="map-legend-item">';
            html += `<div class="map-legend-color map-legend-line" style="background-color: ${parcelSym.strokeColor}; border-radius: 0; height: 3px; ${borderStyle}"></div>`;
            html += '<span class="map-legend-label">Parcels</span>';
            html += '</div>';
        }
        
        // Project Points section
        if (BuilderState.projectsData) {
            const pointsSym = sym.points;
            
            // Section header
            html += '<div class="map-legend-section-header">Project Points</div>';
            
            if (pointsSym.mode === 'plain') {
                // Single color mode
                html += '<div class="map-legend-item map-legend-subitem">';
                html += `<div class="map-legend-color" style="background-color: ${pointsSym.plainColor}"></div>`;
                html += '<span class="map-legend-label">All Projects</span>';
                html += '</div>';
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
                
                // Check if there are too many values
                if (sortedValues.length > 30) {
                    html += '<div class="map-legend-warning">';
                    html += '<i class="fas fa-exclamation-triangle"></i>';
                    html += `<span>Too many values (${sortedValues.length}) to display</span>`;
                    html += '</div>';
                } else {
                    sortedValues.forEach(([value, count]) => {
                        const color = pointsSym.colorMap[value] || '#999999';
                        html += '<div class="map-legend-item map-legend-subitem">';
                        html += `<div class="map-legend-color" style="background-color: ${color}"></div>`;
                        html += `<span class="map-legend-label">${escapeHtml(value)}</span>`;
                        html += '</div>';
                    });
                }
            }
        }
        
        return html;
    },
    
    /**
     * Generate dashboard.js
     */
    generateDashboardJS: function() {
        // Pre-generate legend HTML
        const legendHTMLContent = this.generateLegendHTML().replace(/'/g, "\\'").replace(/\n/g, '');
        const streamsColor = BuilderState.symbology.streams.strokeColor;
        const watershedColor = BuilderState.symbology.watershed.strokeColor;
        const hasParcels = BuilderState.parcelData && BuilderState.parcelData.features.length > 0;
        
        // Generate parcel highlight functions if parcels exist
        const parcelHighlightFunctions = hasParcels ? `

// Highlight parcel at selected point
function highlightParcelAtPoint(pointFeature) {
    clearParcelHighlight();
    
    if (typeof json_parcels === 'undefined' || !json_parcels.features || !json_parcels.features.length) {
        return;
    }
    
    // Get point coordinates in 4326
    var pointGeom = pointFeature.getGeometry();
    var coords3857 = pointGeom.getCoordinates();
    var coords4326 = ol.proj.transform(coords3857, 'EPSG:3857', 'EPSG:4326');
    
    // Create turf point
    var turfPoint = turf.point(coords4326);
    
    // Find intersecting parcel
    var intersectingParcel = null;
    for (var i = 0; i < json_parcels.features.length; i++) {
        var parcel = json_parcels.features[i];
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
        var format = new ol.format.GeoJSON();
        var highlightFeature = format.readFeature(intersectingParcel, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        parcelHighlightSource.addFeature(highlightFeature);
    }
}

function clearParcelHighlight() {
    if (typeof parcelHighlightSource !== 'undefined') {
        parcelHighlightSource.clear();
    }
}
` : '';

        const parcelHighlightOnClick = hasParcels ? 'highlightParcelAtPoint(feature);' : '';
        const parcelClearOnClose = hasParcels ? 'clearParcelHighlight();' : '';
        
        return `/* ===========================================
   Watershed Dashboard - Main Script
   =========================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    initMap();
});

var map;
var popup;
var initialExtent;
var activeFilters = {
    projectTypes: [],
    municipalities: [],
    watersheds: [],
    search: ''
};

function initMap() {
    // Create map
    map = new ol.Map({
        target: 'map',
        layers: layersList,
        view: new ol.View({
            maxZoom: 20,
            minZoom: 5,
            projection: 'EPSG:3857'
        })
    });
    
    // Fit to watershed extent and save it
    var extent = jsonSource_watershed_boundary.getExtent();
    initialExtent = extent;
    map.getView().fit(extent, { padding: [50, 50, 50, 50] });
    
    // Add layer switcher
    var layerSwitcher = new ol.control.LayerSwitcher({
        tipLabel: 'Layers',
        reverse: true,
        groupSelectStyle: 'group'
    });
    map.addControl(layerSwitcher);
    
    // Initialize popup
    initPopup();
    
    // Initialize filters
    initFilters();
    
    // Initialize sidebar toggle
    initSidebarToggle();
    
    // Initialize attribution toggle
    initAttributionToggle();
    
    // Initialize download
    initDownload();
    
    // Initialize legend
    initLegend();
    
    // Update feature counter
    updateFeatureCounter();
}

function initPopup() {
    var container = document.getElementById('popup');
    var content = document.getElementById('popup-content');
    var closer = document.getElementById('popup-closer');
    
    popup = new ol.Overlay({
        element: container,
        autoPan: true,
        autoPanAnimation: { duration: 250 }
    });
    
    map.addOverlay(popup);
    
    closer.onclick = function() {
        popup.setPosition(undefined);
        ${parcelClearOnClose}
        closer.blur();
        return false;
    };
    
    map.on('singleclick', function(evt) {
        var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
            if (layer === lyr_project_points) {
                return feature;
            }
        });
        
        if (feature && !feature.get('_hidden')) {
            showPopup(feature, evt.coordinate);
            ${parcelHighlightOnClick}
        } else {
            popup.setPosition(undefined);
            ${parcelClearOnClose}
        }
    });
    
    map.on('pointermove', function(evt) {
        if (evt.dragging) return;
        
        var hit = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
            return layer === lyr_project_points && !feature.get('_hidden');
        });
        
        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });
}

function showPopup(feature, coordinate) {
    var props = feature.getProperties();
    var content = document.getElementById('popup-content');
    
    var html = '<h4>' + (props.Project_Type || 'Project') + '</h4>';
    
    var fields = [
        { key: 'Landowner', label: 'Landowner' },
        { key: 'Address', label: 'Address' },
        { key: 'Project_Description', label: 'Description' },
        { key: 'Notes', label: 'Notes' },
        { key: 'Municipality', label: 'Municipality' },
        { key: 'Watershed_Name', label: 'Watershed' }
    ];
    
    fields.forEach(function(field) {
        if (props[field.key] && props[field.key] !== '') {
            html += '<div class="popup-row"><span class="popup-label">' + field.label + ':</span> ' + props[field.key] + '</div>';
        }
    });
    
    content.innerHTML = html;
    popup.setPosition(coordinate);
}

function initFilters() {
    populateCheckboxGroup('filter-project-type', 'Project_Type');
    if (document.getElementById('filter-municipality')) {
        populateCheckboxGroup('filter-municipality', 'Municipality');
    }
    if (document.getElementById('filter-watershed')) {
        populateCheckboxGroup('filter-watershed', 'Watershed_Name');
    }
    
    // Setup collapsible labels
    initCollapsibleLabels();
    
    // Initialize landowner search with autocomplete
    initLandownerSearch();
    
    document.getElementById('clear-all-filters-btn').addEventListener('click', clearFilters);
    document.getElementById('zoom-to-filtered-btn').addEventListener('click', zoomToFiltered);
    document.getElementById('reset-extent-btn').addEventListener('click', resetExtent);
    
    // Sidebar close button
    var closeBtn = document.getElementById('utility-bar-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('utility-bar').classList.add('collapsed');
            document.getElementById('sidebar-controls').classList.remove('sidebar-open');
            document.getElementById('feature-counter').classList.remove('sidebar-open');
            var attrBox = document.getElementById('attribution-box');
            if (attrBox) attrBox.classList.remove('sidebar-open');
        });
    }
}

function initLandownerSearch() {
    var searchInput = document.getElementById('filter-search');
    if (!searchInput) return;
    
    var resultsDiv = document.getElementById('landowner-search-results');
    if (!resultsDiv) return;
    
    var debounceTimer;
    
    searchInput.addEventListener('input', function(e) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            var searchText = e.target.value.trim();
            if (searchText.length < 2) {
                resultsDiv.classList.remove('visible');
                resultsDiv.innerHTML = '';
                activeFilters.search = '';
                applyFilters();
                return;
            }
            
            var results = searchLandowners(searchText);
            displaySearchResults(results, resultsDiv, searchInput);
        }, 200);
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.parentElement.contains(e.target)) {
            resultsDiv.classList.remove('visible');
        }
    });
    
    // Show results on focus if there's text
    searchInput.addEventListener('focus', function() {
        if (searchInput.value.trim().length >= 2 && resultsDiv.innerHTML) {
            resultsDiv.classList.add('visible');
        }
    });
}

function searchLandowners(searchText) {
    var results = [];
    var lowerSearch = searchText.toLowerCase();
    
    // Search project points
    lyr_project_points.getSource().getFeatures().forEach(function(feature) {
        var landowner = feature.get('Landowner') || '';
        if (landowner.toLowerCase().indexOf(lowerSearch) !== -1) {
            var similarity = calculateSimilarity(lowerSearch, landowner.toLowerCase());
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
    
    // Search parcels if available
    if (typeof json_parcels !== 'undefined' && json_parcels.features) {
        var landownerFields = ['OWNER', 'OWNER_NAME', 'OWNERNAME', 'LANDOWNER', 'NAME', 'OWNER1', 'PROP_OWNER'];
        
        json_parcels.features.forEach(function(parcel) {
            var props = parcel.properties || {};
            var ownerValue = null;
            
            // Find the landowner field
            for (var i = 0; i < landownerFields.length; i++) {
                if (props[landownerFields[i]]) {
                    ownerValue = props[landownerFields[i]];
                    break;
                }
            }
            
            // Also try case-insensitive search
            if (!ownerValue) {
                for (var key in props) {
                    if (key.toLowerCase().indexOf('owner') !== -1 || key.toLowerCase().indexOf('name') !== -1) {
                        if (props[key] && typeof props[key] === 'string') {
                            ownerValue = props[key];
                            break;
                        }
                    }
                }
            }
            
            if (ownerValue && ownerValue.toLowerCase().indexOf(lowerSearch) !== -1) {
                var similarity = calculateSimilarity(lowerSearch, ownerValue.toLowerCase());
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
    
    // Sort by similarity
    results.sort(function(a, b) { return b.similarity - a.similarity; });
    
    // Remove duplicates
    var seen = {};
    var unique = [];
    for (var i = 0; i < results.length; i++) {
        var key = results[i].name.toLowerCase();
        if (!seen[key]) {
            seen[key] = true;
            unique.push(results[i]);
        }
    }
    
    return unique.slice(0, 5);
}

function calculateSimilarity(search, target) {
    if (target.indexOf(search) === 0) return 3;
    if (target.indexOf(' ' + search) !== -1 || target.indexOf(search + ' ') !== -1) return 2;
    if (target.indexOf(search) !== -1) return 1;
    return 0;
}

function displaySearchResults(results, resultsDiv, searchInput) {
    if (results.length === 0) {
        resultsDiv.classList.remove('visible');
        resultsDiv.innerHTML = '';
        return;
    }
    
    var html = '';
    for (var i = 0; i < results.length; i++) {
        var result = results[i];
        html += '<div class="landowner-result-item" data-index="' + i + '">';
        html += '<span class="result-name">' + escapeHtml(result.name) + '</span>';
        html += '<span class="result-source">(' + result.source + ')</span>';
        if (result.detail) {
            html += '<div class="result-detail">' + escapeHtml(result.detail) + '</div>';
        }
        html += '</div>';
    }
    
    resultsDiv.innerHTML = html;
    resultsDiv.classList.add('visible');
    
    // Store results for click handlers
    resultsDiv._results = results;
    
    // Add click handlers
    var items = resultsDiv.querySelectorAll('.landowner-result-item');
    for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('click', function(e) {
            var index = parseInt(this.getAttribute('data-index'));
            var result = resultsDiv._results[index];
            searchInput.value = result.name;
            resultsDiv.classList.remove('visible');
            
            activeFilters.search = result.name.toLowerCase();
            applyFilters();
            
            if (result.type === 'point' && result.feature) {
                var extent = result.feature.getGeometry().getExtent();
                map.getView().fit(extent, { maxZoom: 17, padding: [100, 100, 100, 100] });
                showPopup(result.feature, result.feature.getGeometry().getCoordinates());
                ${parcelHighlightOnClick ? 'highlightParcelAtPoint(result.feature);' : ''}
            } else if (result.type === 'parcel' && result.parcel) {
                highlightParcelFromGeoJSON(result.parcel);
            }
        });
    }
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightParcelFromGeoJSON(parcel) {
    ${hasParcels ? `
    clearParcelHighlight();
    
    if (!parcel) return;
    
    var format = new ol.format.GeoJSON();
    var highlightFeature = format.readFeature(parcel, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
    });
    
    parcelHighlightSource.addFeature(highlightFeature);
    
    var extent = highlightFeature.getGeometry().getExtent();
    map.getView().fit(extent, { maxZoom: 17, padding: [100, 100, 100, 100] });
    ` : ''}
}

function initCollapsibleLabels() {
    var labels = document.querySelectorAll('.collapsible-label');
    labels.forEach(function(label) {
        label.addEventListener('click', function() {
            var targetId = label.getAttribute('data-target');
            var target = document.getElementById(targetId);
            var icon = label.querySelector('.collapse-icon');
            
            if (target) {
                target.classList.toggle('collapsed');
            }
            if (icon) {
                icon.classList.toggle('collapsed');
            }
        });
    });
}

function populateCheckboxGroup(groupId, fieldName) {
    var group = document.getElementById(groupId);
    if (!group) return;
    
    var values = new Set();
    lyr_project_points.getSource().getFeatures().forEach(function(feature) {
        var val = feature.get(fieldName);
        if (val && val !== '') {
            values.add(val);
        }
    });
    
    group.innerHTML = '';
    Array.from(values).sort().forEach(function(val) {
        var label = document.createElement('label');
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = val;
        checkbox.addEventListener('change', function() {
            updateFilterFromCheckboxes(groupId, fieldName);
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + val));
        group.appendChild(label);
    });
}

function updateFilterFromCheckboxes(groupId, fieldName) {
    var group = document.getElementById(groupId);
    var checkboxes = group.querySelectorAll('input[type="checkbox"]:checked');
    var values = Array.from(checkboxes).map(function(cb) { return cb.value; });
    
    if (fieldName === 'Project_Type') {
        activeFilters.projectTypes = values;
    } else if (fieldName === 'Municipality') {
        activeFilters.municipalities = values;
    } else if (fieldName === 'Watershed_Name') {
        activeFilters.watersheds = values;
    }
    
    applyFilters();
}

function applyFilters() {
    var features = lyr_project_points.getSource().getFeatures();
    
    features.forEach(function(feature) {
        var visible = true;
        
        // Project type filter (multiple selection)
        if (activeFilters.projectTypes && activeFilters.projectTypes.length > 0) {
            var featureType = feature.get('Project_Type');
            if (activeFilters.projectTypes.indexOf(featureType) === -1) {
                visible = false;
            }
        }
        
        // Municipality filter (multiple selection)
        if (visible && activeFilters.municipalities && activeFilters.municipalities.length > 0) {
            var featureMuni = feature.get('Municipality');
            if (activeFilters.municipalities.indexOf(featureMuni) === -1) {
                visible = false;
            }
        }
        
        // Watershed filter (multiple selection)
        if (visible && activeFilters.watersheds && activeFilters.watersheds.length > 0) {
            var featureWatershed = feature.get('Watershed_Name');
            if (activeFilters.watersheds.indexOf(featureWatershed) === -1) {
                visible = false;
            }
        }
        
        if (visible && activeFilters.search) {
            var searchText = activeFilters.search;
            var landowner = (feature.get('Landowner') || '').toLowerCase();
            var address = (feature.get('Address') || '').toLowerCase();
            var description = (feature.get('Project_Description') || '').toLowerCase();
            var notes = (feature.get('Notes') || '').toLowerCase();
            
            if (!landowner.includes(searchText) && 
                !address.includes(searchText) && 
                !description.includes(searchText) &&
                !notes.includes(searchText)) {
                visible = false;
            }
        }
        
        feature.set('_hidden', !visible);
    });
    
    lyr_project_points.changed();
    updateFeatureCounter();
}

function clearFilters() {
    activeFilters = {
        projectTypes: [],
        municipalities: [],
        watersheds: [],
        search: ''
    };
    
    // Reset all checkboxes
    var checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    checkboxes.forEach(function(cb) { cb.checked = false; });
    
    // Reset search input and hide results
    document.getElementById('filter-search').value = '';
    var resultsDiv = document.getElementById('landowner-search-results');
    if (resultsDiv) {
        resultsDiv.classList.remove('visible');
        resultsDiv.innerHTML = '';
    }
    
    lyr_project_points.getSource().getFeatures().forEach(function(feature) {
        feature.set('_hidden', false);
    });
    
    lyr_project_points.changed();
    updateFeatureCounter();
}

function zoomToFiltered() {
    var visibleFeatures = lyr_project_points.getSource().getFeatures().filter(function(f) {
        return !f.get('_hidden');
    });
    
    if (visibleFeatures.length === 0) {
        alert('No visible features to zoom to.');
        return;
    }
    
    var extent = ol.extent.createEmpty();
    visibleFeatures.forEach(function(feature) {
        ol.extent.extend(extent, feature.getGeometry().getExtent());
    });
    
    map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 16
    });
}

function resetExtent() {
    if (initialExtent) {
        map.getView().fit(initialExtent, {
            padding: [50, 50, 50, 50],
            duration: 500
        });
    }
}

function updateFeatureCounter() {
    var total = lyr_project_points.getSource().getFeatures().length;
    var visible = lyr_project_points.getSource().getFeatures().filter(function(f) {
        return !f.get('_hidden');
    }).length;
    
    var counterEl = document.getElementById('project-counter');
    if (counterEl) {
        counterEl.innerHTML = '<span class="count">' + visible + '</span> of ' + total + ' projects';
    }
}

function initSidebarToggle() {
    var sidebar = document.getElementById('utility-bar');
    var controls = document.getElementById('sidebar-controls');
    var toggleBtn = document.getElementById('sidebar-toggle-btn');
    var featureCounter = document.getElementById('feature-counter');
    var attributionBox = document.getElementById('attribution-box');
    
    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        controls.classList.toggle('sidebar-open');
        featureCounter.classList.toggle('sidebar-open');
        if (attributionBox) attributionBox.classList.toggle('sidebar-open');
    });
}

function initAttributionToggle() {
    var attributionBox = document.getElementById('attribution-box');
    var toggleBtn = document.getElementById('attribution-toggle');
    
    if (!attributionBox || !toggleBtn) return;
    
    toggleBtn.addEventListener('click', function() {
        attributionBox.classList.toggle('collapsed');
    });
}

function initDownload() {
    var downloadBtn = document.getElementById('download-btn');
    var modal = document.getElementById('download-modal');
    var closeBtn = modal.querySelector('.modal-close');
    var cancelBtn = document.getElementById('download-cancel-btn');
    var confirmBtn = document.getElementById('download-confirm-btn');
    
    downloadBtn.addEventListener('click', function() {
        modal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    
    cancelBtn.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    
    confirmBtn.addEventListener('click', function() {
        downloadFilteredData();
        modal.classList.add('hidden');
    });
}

function downloadFilteredData() {
    var filename = document.getElementById('download-filename').value || 'projects';
    var format = document.getElementById('download-format').value || 'xlsx';
    
    var visibleFeatures = lyr_project_points.getSource().getFeatures().filter(function(f) {
        return !f.get('_hidden');
    });
    
    if (visibleFeatures.length === 0) {
        alert('No visible features to download.');
        return;
    }
    
    if (format === 'geojson') {
        downloadAsGeoJSON(visibleFeatures, filename);
    } else if (format === 'csv') {
        downloadAsCSV(visibleFeatures, filename);
    } else if (format === 'xlsx') {
        downloadAsExcel(visibleFeatures, filename);
    }
}

function downloadAsGeoJSON(features, filename) {
    var geoJSONFormat = new ol.format.GeoJSON();
    var featureCollection = {
        type: 'FeatureCollection',
        features: features.map(function(f) {
            var clone = f.clone();
            clone.unset('_hidden');
            var geojson = JSON.parse(geoJSONFormat.writeFeature(clone, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            }));
            return geojson;
        })
    };
    
    var blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename + '.geojson');
}

function downloadAsCSV(features, filename) {
    var headers = ['Project_Type', 'Landowner', 'Address', 'Project_Description', 'Notes', 'Municipality', 'Watershed_Name', 'Longitude', 'Latitude'];
    var csv = headers.join(',') + '\\n';
    
    features.forEach(function(f) {
        var props = f.getProperties();
        var geom = f.getGeometry();
        var lon = '', lat = '';
        
        if (geom) {
            var coords = ol.proj.transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
            lon = coords[0].toFixed(6);
            lat = coords[1].toFixed(6);
        }
        
        var row = headers.slice(0, 7).map(function(h) {
            var val = props[h] || '';
            if (typeof val === 'string' && (val.indexOf(',') !== -1 || val.indexOf('"') !== -1)) {
                return '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        row.push(lon, lat);
        csv += row.join(',') + '\\n';
    });
    
    var blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, filename + '.csv');
}

function downloadAsExcel(features, filename) {
    if (typeof XLSX === 'undefined') {
        alert('Excel export not available. Please use CSV or GeoJSON format.');
        return;
    }
    
    var headers = ['Project_Type', 'Landowner', 'Address', 'Project_Description', 'Notes', 'Municipality', 'Watershed_Name', 'Longitude', 'Latitude'];
    var data = [headers];
    
    features.forEach(function(f) {
        var props = f.getProperties();
        var geom = f.getGeometry();
        var lon = '', lat = '';
        
        if (geom) {
            var coords = ol.proj.transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
            lon = coords[0].toFixed(6);
            lat = coords[1].toFixed(6);
        }
        
        var row = headers.slice(0, 7).map(function(h) { return props[h] || ''; });
        row.push(lon, lat);
        data.push(row);
    });
    
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, filename + '.xlsx');
}

function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =========================================
// Legend Functions
// =========================================

var legendVisible = false;

function initLegend() {
    var toggleBtn = document.getElementById('legend-toggle-btn');
    var closeBtn = document.getElementById('map-legend-close');
    var legend = document.getElementById('map-legend');
    
    // Toggle button click
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            legendVisible = !legendVisible;
            toggleLegend(legendVisible);
            toggleBtn.classList.toggle('active', legendVisible);
        });
    }
    
    // Close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            legendVisible = false;
            toggleLegend(false);
            if (toggleBtn) toggleBtn.classList.remove('active');
        });
    }
    
    // Build legend content
    updateLegendContent();
}

function toggleLegend(show) {
    var legend = document.getElementById('map-legend');
    if (legend) {
        if (show) {
            legend.classList.remove('hidden');
        } else {
            legend.classList.add('hidden');
        }
    }
}

function updateLegendContent() {
    var content = document.getElementById('map-legend-content');
    if (!content) return;
    
    // Legend content is pre-generated from the builder symbology settings
    // This is a static, read-only legend
    content.innerHTML = legendHTML;
}

// Pre-generated legend HTML from builder symbology
var legendHTML = '${legendHTMLContent}';

function getStreamsColor() {
    return '${streamsColor}';
}

function getWatershedColor() {
    return '${watershedColor}';
}
${parcelHighlightFunctions}
`;
    },
    
    /**
     * Get functions.js content
     */
    getFunctionsJS: function() {
        return `/* Helper Functions */

var createTextStyle = function(feature, resolution, labelText, labelFont,
                               labelFill, placement, bufferColor,
                               bufferWidth) {
    if (feature.hide || !labelText) {
        return; 
    } 

    if (bufferWidth == 0) {
        var bufferStyle = null;
    } else {
        var bufferStyle = new ol.style.Stroke({
            color: bufferColor,
            width: bufferWidth
        });
    }
    
    var textStyle = new ol.style.Text({
        font: labelFont,
        text: labelText,
        textBaseline: "middle",
        textAlign: "left",
        offsetX: 8,
        offsetY: 3,
        placement: placement,
        maxAngle: 0,
        fill: new ol.style.Fill({
          color: labelFill
        }),
        stroke: bufferStyle
    });

    return textStyle;
};
`;
    },
    
    /**
     * Generate README
     */
    generateReadme: function() {
        const title = BuilderState.dashboardConfig.title || 'Watershed Dashboard';
        const date = new Date().toLocaleDateString();
        
        return `${title}
${'='.repeat(title.length)}

Generated: ${date}

INSTRUCTIONS
------------
1. Extract all files from this ZIP archive
2. Keep the folder structure intact
3. Open index.html in a web browser

REQUIREMENTS
------------
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Internet connection (for loading map tiles and libraries)

CONTENTS
--------
- index.html          : Main dashboard page
- css/                : Stylesheet files
- layers/             : GeoJSON layer data
- styles/             : Layer style definitions
- resources/          : JavaScript files

FEATURES
--------
- Interactive map with satellite and street map base layers
- Project points with popup information on click
- Stream network layer (from PA DEP IR 2026)
- Watershed boundary layer
- Municipality boundaries (auto-fetched from PennDOT)
- Map legend (toggle from layer switcher panel)
- Filtering sidebar:
  - Filter by Project Type
  - Filter by Municipality
  - Filter by Watershed
  - Text search across all fields
- Feature counter showing visible/total projects
- Download filtered data:
  - Excel (.xlsx) format
  - CSV format
  - GeoJSON format
- Map controls:
  - Clear Filters - reset all filters
  - Zoom to Filtered - zoom to visible features
  - Reset Extent - return to initial map view
- Layer switcher for toggling layers, base maps, and legend

FIELDS
------
Project points include these standardized fields:
- Project_Type
- Landowner
- Address
- Project_Description
- Notes
- Municipality
- Watershed_Name

DATA DOWNLOAD
-------------
The Download button allows users to export visible project points
in multiple formats. Filtered data includes latitude/longitude
coordinates for each project point.

Created with Watershed Dashboard Builder
`;
    }
};

// Bind modal events on load
document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.getElementById('export-modal-close');
    const cancelBtn = document.getElementById('export-cancel-btn');
    
    if (closeBtn) closeBtn.onclick = () => ExportDashboard.hideModal();
    if (cancelBtn) cancelBtn.onclick = () => ExportDashboard.hideModal();
});
