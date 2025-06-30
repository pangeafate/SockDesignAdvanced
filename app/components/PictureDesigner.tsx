'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export default function PictureDesigner() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [resolution, setResolution] = useState(32);
  const [maxColors, setMaxColors] = useState(8);
  const [pixelatedImage, setPixelatedImage] = useState<ImageData | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color distance calculation
  const colorDistance = (c1: Color, c2: Color): number => {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) + 
      Math.pow(c1.g - c2.g, 2) + 
      Math.pow(c1.b - c2.b, 2)
    );
  };

  // K-means color quantization
  const quantizeColors = (imageData: ImageData, k: number): string[] => {
    const pixels: Color[] = [];
    
    // Extract all pixels
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 128) { // Only non-transparent pixels
        pixels.push({
          r: imageData.data[i],
          g: imageData.data[i + 1],
          b: imageData.data[i + 2],
          a: imageData.data[i + 3]
        });
      }
    }

    if (pixels.length === 0) return [];

    // Initialize centroids randomly
    const centroids: Color[] = [];
    for (let i = 0; i < k; i++) {
      const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
      centroids.push({ ...randomPixel });
    }

    // K-means iterations
    for (let iter = 0; iter < 20; iter++) {
      const clusters: Color[][] = Array(k).fill(null).map(() => []);
      
      // Assign pixels to closest centroid
      pixels.forEach(pixel => {
        let minDist = Infinity;
        let closestCentroid = 0;
        
        centroids.forEach((centroid, i) => {
          const dist = colorDistance(pixel, centroid);
          if (dist < minDist) {
            minDist = dist;
            closestCentroid = i;
          }
        });
        
        clusters[closestCentroid].push(pixel);
      });

      // Update centroids
      centroids.forEach((centroid, i) => {
        if (clusters[i].length > 0) {
          centroid.r = clusters[i].reduce((sum, p) => sum + p.r, 0) / clusters[i].length;
          centroid.g = clusters[i].reduce((sum, p) => sum + p.g, 0) / clusters[i].length;
          centroid.b = clusters[i].reduce((sum, p) => sum + p.b, 0) / clusters[i].length;
        }
      });
    }

    return centroids.map(c => 
      `#${Math.round(c.r).toString(16).padStart(2, '0')}${Math.round(c.g).toString(16).padStart(2, '0')}${Math.round(c.b).toString(16).padStart(2, '0')}`
    );
  };

  // Pixelate and quantize image
  const processImage = useCallback(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep canvas display size constant (400px width)
    const displayWidth = 400;
    const displayHeight = Math.round((displayWidth * image.height) / image.width);
    
    // Set actual canvas resolution based on pixel resolution setting
    canvas.width = resolution;
    canvas.height = Math.round((resolution * image.height) / image.width);
    
    // Set display size via CSS to keep visual size constant
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Draw image at low resolution
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Get color palette
    const palette = quantizeColors(imageData, maxColors);
    setColors(palette);

    // Apply color quantization
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 128) { // Only non-transparent pixels
        const pixel: Color = {
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
          a: data[i + 3]
        };

        // Find closest palette color
        let minDist = Infinity;
        let closestColor = palette[0];
        
        palette.forEach(colorHex => {
          const color: Color = {
            r: parseInt(colorHex.slice(1, 3), 16),
            g: parseInt(colorHex.slice(3, 5), 16),
            b: parseInt(colorHex.slice(5, 7), 16),
            a: 255
          };
          
          const dist = colorDistance(pixel, color);
          if (dist < minDist) {
            minDist = dist;
            closestColor = colorHex;
          }
        });

        // Apply closest color
        const r = parseInt(closestColor.slice(1, 3), 16);
        const g = parseInt(closestColor.slice(3, 5), 16);
        const b = parseInt(closestColor.slice(5, 7), 16);
        
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setPixelatedImage(imageData);
  }, [image, resolution, maxColors]);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setImage(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle canvas painting
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !pixelatedImage) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get current image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Convert hex color to RGB
    const r = parseInt(selectedColor.slice(1, 3), 16);
    const g = parseInt(selectedColor.slice(3, 5), 16);
    const b = parseInt(selectedColor.slice(5, 7), 16);

    // Update the pixel in the image data
    const pixelIndex = (y * canvas.width + x) * 4;
    data[pixelIndex] = r;
    data[pixelIndex + 1] = g;
    data[pixelIndex + 2] = b;
    data[pixelIndex + 3] = 255; // Full opacity

    // Put the updated image data back
    ctx.putImageData(imageData, 0, 0);

    // Update stored image data
    setPixelatedImage(imageData);
  };

  // Remove background (make transparent)
  const removeBackground = () => {
    if (!canvasRef.current || !pixelatedImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Get corner colors as background colors
    const backgroundColors = [
      [data[0], data[1], data[2]], // Top-left
      [data[(canvas.width - 1) * 4], data[(canvas.width - 1) * 4 + 1], data[(canvas.width - 1) * 4 + 2]], // Top-right
      [data[(canvas.height - 1) * canvas.width * 4], data[(canvas.height - 1) * canvas.width * 4 + 1], data[(canvas.height - 1) * canvas.width * 4 + 2]], // Bottom-left
    ];

    // Make similar colors transparent
    for (let i = 0; i < data.length; i += 4) {
      const pixel = [data[i], data[i + 1], data[i + 2]];
      
      for (const bgColor of backgroundColors) {
        const distance = Math.sqrt(
          Math.pow(pixel[0] - bgColor[0], 2) +
          Math.pow(pixel[1] - bgColor[1], 2) +
          Math.pow(pixel[2] - bgColor[2], 2)
        );
        
        if (distance < 50) { // Threshold for background detection
          data[i + 3] = 0; // Make transparent
          break;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setPixelatedImage(imageData);
  };

  // Update a color in the palette and reprocess image
  const updatePaletteColor = (index: number, newColor: string) => {
    const updatedColors = [...colors];
    const oldColor = updatedColors[index];
    updatedColors[index] = newColor;
    setColors(updatedColors);

    // Update all pixels with the old color to the new color
    if (!canvasRef.current || !pixelatedImage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert old and new colors to RGB
    const oldRgb = {
      r: parseInt(oldColor.slice(1, 3), 16),
      g: parseInt(oldColor.slice(3, 5), 16),
      b: parseInt(oldColor.slice(5, 7), 16)
    };
    const newRgb = {
      r: parseInt(newColor.slice(1, 3), 16),
      g: parseInt(newColor.slice(3, 5), 16),
      b: parseInt(newColor.slice(5, 7), 16)
    };

    // Replace all instances of old color with new color
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === oldRgb.r && data[i + 1] === oldRgb.g && data[i + 2] === oldRgb.b) {
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setPixelatedImage(imageData);
  };

  // Download image
  const downloadImage = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = 'pixelated-design.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  // Reset component to initial state
  const resetComponent = () => {
    setImage(null);
    setResolution(32);
    setMaxColors(8);
    setPixelatedImage(null);
    setColors([]);
    setSelectedColor('#000000');
    setIsDrawing(false);
    setEditingColorIndex(null);
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Process image when parameters change
  useEffect(() => {
    if (image) {
      processImage();
    }
  }, [image, processImage]);

  return (
    <div className="main-content">
      <div className={`canvas-area ${image ? 'has-content' : ''}`}>
        {!image ? (
          <div 
            className="upload-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <p>Click to upload or drag and drop an image</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="file-input"
            />
          </div>
        ) : (
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{ 
                imageRendering: 'pixelated',
                cursor: 'crosshair',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px'
              }}
            />
          </div>
        )}
      </div>

      <div className="controls-panel">
        <div className="control-group">
          <h3>Resolution</h3>
          <div className="slider">
            <input
              type="range"
              min="16"
              max="128"
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
            />
            <span>{resolution}px</span>
          </div>
        </div>

        <div className="control-group">
          <h3>Max Colors</h3>
          <div className="slider">
            <input
              type="range"
              min="2"
              max="16"
              value={maxColors}
              onChange={(e) => setMaxColors(Number(e.target.value))}
            />
            <span>{maxColors} colors</span>
          </div>
        </div>

        {colors.length > 0 && (
          <div className="control-group">
            <h3>Color Palette</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '10px' }}>
              {colors.map((color, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <div
                    className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                    style={{ 
                      backgroundColor: color,
                      position: 'relative',
                      width: '40px',
                      height: '40px'
                    }}
                    onClick={() => setSelectedColor(color)}
                  />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => updatePaletteColor(index, e.target.value)}
                    style={{ 
                      width: '40px', 
                      height: '20px', 
                      border: 'none', 
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title={`Edit color`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="control-group">
          <h3>Actions</h3>
          <button
            className="button"
            onClick={removeBackground}
            disabled={!pixelatedImage}
          >
            Remove Background
          </button>
          <button
            className="button"
            onClick={downloadImage}
            disabled={!pixelatedImage}
          >
            Download PNG
          </button>
          <button
            className="button"
            onClick={resetComponent}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
} 