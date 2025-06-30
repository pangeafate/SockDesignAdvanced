# Knitting Socks Designer Advanced

An enhanced web application for designing patterns and color schemes for knitting socks. This advanced version includes improved pixelization algorithms and clipboard paste functionality.

## New Features in Advanced Version

### Enhanced Picture Design
- **Clipboard Paste**: Paste images directly from clipboard using Ctrl+V (Cmd+V on Mac)
- **Smart Pixelization**: Advanced algorithm that better preserves image details at lower resolutions
- **Knitting-Optimized Color Quantization**: Improved color reduction specifically designed for knitting patterns
- **Edge Detection**: Better handling of edges and contrasts for clearer knitting patterns

### Original Features
- **Upload Images**: Drag and drop or click to upload images
- **Adjustable Pixelation**: Convert images to pixel art with adjustable resolution (8-64px)
- **Color Quantization**: Reduce colors to a specified palette (2-16 colors)
- **Pixel Editing**: Click on individual pixels to change their colors
- **Background Removal**: Remove background colors automatically
- **PNG Download**: Export your pixelated designs

### Sock Color Design
- **Schematic Views**: Side view and bottom view of sock design
- **Color Customization**: Separate colors for main body, heel, and toe
- **Real-time Preview**: See changes instantly as you modify colors
- **Color Palette**: View all colors used in your design
- **PNG Export**: Download your sock design as PNG
- **Reset Function**: Restore default colors

## Tech Stack

- **Next.js 15.3.4**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **HTML5 Canvas**: For image processing and drawing
- **CSS3**: Modern styling with gradients and animations
- **Advanced Algorithms**: K-means clustering, edge detection, smart sampling

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pangeafate/SockDesignAdvanced.git
cd SockDesignAdvanced
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Picture Design Mode
1. Switch to the "Picture Design" tab
2. Upload an image by:
   - Clicking or dragging into the upload area
   - **NEW**: Pasting from clipboard (Ctrl+V / Cmd+V)
3. Adjust the resolution slider to change pixel size (8-64px)
4. Modify the max colors slider to control color palette size (2-16 colors)
5. The advanced algorithm will create a knitting-optimized pattern
6. Click on individual pixels to edit with selected colors
7. Use "Remove Background" to make background transparent
8. Download your design with "Download PNG"

### Sock Color Design Mode
1. Switch to the "Sock Color Design" tab
2. Use color pickers to customize:
   - Main sock body color
   - Heel color
   - Toe color
3. View the real-time preview in both side and bottom views
4. Download your sock design as PNG
5. Use "Reset Colors" to restore defaults

## Advanced Pixelization Algorithm

The enhanced pixelization algorithm includes:

- **Smart Sampling**: Weighted average based on edge detection and contrast
- **Edge Preservation**: Special handling of edges for clearer pattern definition
- **Knitting Optimization**: Color selection optimized for knitting visibility
- **Frequency-Based Clustering**: K-means algorithm that considers color frequency
- **Contrast Enhancement**: Automatic boosting of high-contrast areas

## Deployment

### GitHub Pages
This project is configured for GitHub Pages deployment:

```bash
npm run build
```

The build will be optimized for static hosting with the correct base paths.

### Local Static Build
```bash
npm run build
npm run start
```

## Project Structure

```
├── app/
│   ├── components/
│   │   ├── PictureDesigner.tsx    # Enhanced image processing component
│   │   └── SockDesigner.tsx       # Sock design component
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page component
├── package.json
├── next.config.js                 # Configured for GitHub Pages
└── tsconfig.json
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your knitting adventures!

## Changelog

### v2.0 (Advanced)
- Added clipboard paste functionality
- Implemented advanced pixelization algorithm
- Enhanced color quantization for knitting
- Improved edge detection and preservation
- Better mobile responsiveness

### v1.0 (Original)
- Basic image upload and pixelization
- Color quantization with K-means
- Sock color design tool
- PNG export functionality 