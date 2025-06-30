# Knitting Socks Designer

A web application for designing patterns and color schemes for knitting socks. This tool allows you to create pixelated designs from images and design custom sock color patterns.

## Features

### Picture Design
- **Upload Images**: Drag and drop or click to upload images
- **Pixelation**: Convert images to pixel art with adjustable resolution (16-128px)
- **Color Quantization**: Reduce colors to a specified palette (2-16 colors)
- **Pixel Editing**: Click on individual pixels to change their colors
- **Color Palette**: View and select from extracted colors
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
- **File API**: For image upload and download

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd knitting-socks-designer
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
2. Upload an image by clicking or dragging into the upload area
3. Adjust the resolution slider to change pixel size
4. Modify the max colors slider to control color palette size
5. Click on individual pixels to paint with selected colors
6. Use "Remove Background" to make background transparent
7. Download your design with "Download PNG"

### Sock Color Design Mode
1. Switch to the "Sock Color Design" tab
2. Use color pickers to customize:
   - Main sock body color
   - Heel color
   - Toe color
3. View the real-time preview in both side and bottom views
4. Download your sock design as PNG
5. Use "Reset Colors" to restore defaults

## Development

### Project Structure
```
├── app/
│   ├── components/
│   │   ├── PictureDesigner.tsx    # Image processing component
│   │   └── SockDesigner.tsx       # Sock design component
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page component
├── package.json
├── next.config.js
└── tsconfig.json
```

### Key Technologies Used
- **K-means Color Quantization**: Advanced algorithm for reducing image colors
- **HTML5 Canvas API**: For pixel-level image manipulation
- **React Hooks**: State management and side effects
- **CSS Grid & Flexbox**: Responsive layout design
- **File Download API**: Browser-native file saving

## Building for Production

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your knitting adventures!

## Future Enhancements

- Import/export pattern files
- More sock templates (crew, ankle, knee-high)
- Pattern sharing community
- Mobile app version
- Integration with knitting calculators 