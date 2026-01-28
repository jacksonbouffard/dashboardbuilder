# Watershed Dashboard Builder

Welcome to the Penn State Agriculture and Environment Center's Watershed Dashboard Builder - an internal tool for AEC technical staff to create standalone watershed dashboard maps for external partners.

## Overview

This is a no-code, no-backend web application that allows technical staff to create custom watershed dashboards from GeoJSON data. Streams and municipality boundaries are automatically fetched from PA DEP and PennDOT services.

## How It Works

1. **Upload Files** - Upload your GeoJSON files:
   - **Project Points** - Point layer with project locations
   - **Watershed Boundary** - Polygon layer with watershed extent
   - Streams and municipalities are **auto-fetched** from PA state services

2. **Map Fields** - Map your source data fields to the standardized dashboard fields:
   - `Project_Type`
   - `Landowner`
   - `Address`
   - `Project_Description`
   - `Notes`
   - `Municipality`
   - `Watershed_Name`

3. **Preview** - Click "Preview Dashboard" to see the interactive map with:
   - Filtering sidebar (Project Type, Municipality, Watershed, Search)
   - Feature counter showing visible/total projects
   - Popup information on project click
   - Multiple base map options

4. **Export** - Click "Export Dashboard" to download a ZIP file containing:
   - Self-contained HTML/CSS/JS dashboard
   - All layer data and styles
   - README with instructions
   - No server required - just open index.html in a browser!

## Getting Started

1. Open `index.html` in your browser
2. Upload your GeoJSON files (Project Points and Watershed Boundary)
3. Configure field mappings
4. Set dashboard title and description
5. Preview and export

## Exported Dashboard Features

The exported dashboard includes:
- ✓ Interactive map with satellite/street basemaps
- ✓ Layer switcher
- ✓ Filtering sidebar
- ✓ Feature counter
- ✓ Popup information
- ✓ Zoom controls
- ✓ Fully self-contained (loads libraries from CDN)

## Project Structure

```
universaldashboard/
├── index.html          # Main builder page
├── css/
│   ├── builder.css     # Upload screen styles
│   └── preview.css     # Preview mode styles
├── js/
│   ├── builder-core.js    # File upload and state management
│   ├── preview-mode.js    # Map preview functionality
│   └── export-dashboard.js # ZIP export generation
├── resources/          # OpenLayers and other libraries
└── webfonts/           # FontAwesome fonts
```

## Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- GeoJSON files for your watershed data
- Internet connection (for loading map tiles and fetching stream/municipality data)

## Technical Notes

- No backend server required
- Uses OpenLayers for mapping
- Uses Turf.js for geometry operations (clipping streams/municipalities)
- Uses JSZip for export functionality
- Streams fetched from PA DEP ArcGIS service
- Municipalities fetched from PennDOT ArcGIS service
- Exported dashboards load OpenLayers from CDN
- All processing happens client-side
