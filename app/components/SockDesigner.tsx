'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export default function SockDesigner() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [resolution, setResolution] = useState(1024);
  const [maxColors, setMaxColors] = useState(7);
  const [pixelatedImage, setPixelatedImage] = useState<ImageData | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const shouldRecalculateColors = useRef(true);
  const currentColors = useRef<string[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
// Load default sock image on component mount
useEffect(() => {
    const loadDefaultImage = () => {
      // Try multiple possible paths for the image
      const possiblePaths = [
        '/SockDesign/images/default-sock.png', // GitHub Pages with base path
        './images/default-sock.png',           // Relative path
        '/images/default-sock.png',            // Root path
        'images/default-sock.png'              // Direct relative
      ];
      
      let currentPathIndex = 0;
      
      const tryNextPath = () => {
        if (currentPathIndex >= possiblePaths.length) {
          console.error('Failed to load default sock image from all paths');
          return;
        }
        
        const img = new Image();
        img.onload = () => {
          console.log(`Successfully loaded image from: ${possiblePaths[currentPathIndex]}`);
          shouldRecalculateColors.current = true;
          setImage(img);
        };
        img.onerror = (e) => {
          console.log(`Failed to load from ${possiblePaths[currentPathIndex]}, trying next path...`);
          currentPathIndex++;
          tryNextPath();
        };
        
        img.src = possiblePaths[currentPathIndex];
      };
      
      tryNextPath();
    };
    
    loadDefaultImage();
  }, []);

  // Color distance calculation
  const colorDistance = (c1: Color, c2: Color): number => {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) + 
      Math.pow(c1.g - c2.g, 2) + 
      Math.pow(c1.b - c2.b, 2)
    );
  };

  // K-means color quantization with deterministic initialization
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

    // Find most frequent colors for better initialization
    const colorFrequency = new Map<string, { color: Color, count: number }>();
    
    pixels.forEach(pixel => {
      // Round colors to reduce noise and group similar colors
      const roundedColor = {
        r: Math.round(pixel.r / 8) * 8,
        g: Math.round(pixel.g / 8) * 8,
        b: Math.round(pixel.b / 8) * 8,
        a: pixel.a
      };
      const colorKey = `${roundedColor.r}-${roundedColor.g}-${roundedColor.b}`;
      
      if (colorFrequency.has(colorKey)) {
        colorFrequency.get(colorKey)!.count++;
      } else {
        colorFrequency.set(colorKey, { color: roundedColor, count: 1 });
      }
    });

    // Sort by frequency and take top colors as initial centroids
    const sortedColors = Array.from(colorFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, k);

    // Initialize centroids with most frequent colors
    const centroids: Color[] = sortedColors.map(item => ({ ...item.color }));
    
    // If we need more centroids than frequent colors, fill with distributed colors
    while (centroids.length < k) {
      const remainingPixels = pixels.filter(pixel => {
        return !centroids.some(centroid => 
          Math.abs(pixel.r - centroid.r) < 16 &&
          Math.abs(pixel.g - centroid.g) < 16 &&
          Math.abs(pixel.b - centroid.b) < 16
        );
      });
      
      if (remainingPixels.length > 0) {
        const index = Math.floor(remainingPixels.length / (k - centroids.length + 1));
        centroids.push({ ...remainingPixels[index] });
      } else {
        // Fallback: create a variation of existing centroid
        const baseCentroid = centroids[centroids.length % centroids.length];
        centroids.push({
          r: Math.min(255, Math.max(0, baseCentroid.r + (centroids.length * 20))),
          g: Math.min(255, Math.max(0, baseCentroid.g + (centroids.length * 20))),
          b: Math.min(255, Math.max(0, baseCentroid.b + (centroids.length * 20))),
          a: baseCentroid.a
        });
      }
    }

    // K-means iterations
    for (let iter = 0; iter < 15; iter++) {
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
      let changed = false;
      centroids.forEach((centroid, i) => {
        if (clusters[i].length > 0) {
          const newR = clusters[i].reduce((sum, p) => sum + p.r, 0) / clusters[i].length;
          const newG = clusters[i].reduce((sum, p) => sum + p.g, 0) / clusters[i].length;
          const newB = clusters[i].reduce((sum, p) => sum + p.b, 0) / clusters[i].length;
          
          if (Math.abs(centroid.r - newR) > 1 || Math.abs(centroid.g - newG) > 1 || Math.abs(centroid.b - newB) > 1) {
            changed = true;
          }
          
          centroid.r = newR;
          centroid.g = newG;
          centroid.b = newB;
        }
      });
      
      // Early termination if centroids don't change much
      if (!changed) break;
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

    // Keep canvas display size constant (600px width - 50% larger)
    const displayWidth = 600;
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
    
    // Get color palette - only recalculate if flag is set or no colors exist
    let palette = currentColors.current;
    if (shouldRecalculateColors.current || currentColors.current.length === 0) {
      palette = quantizeColors(imageData, maxColors);
      setColors(palette);
      currentColors.current = palette;
      shouldRecalculateColors.current = false; // Reset flag after calculating
    }

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
        shouldRecalculateColors.current = true; // New image should recalculate colors
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
        img.onload = () => {
          shouldRecalculateColors.current = true; // New image should recalculate colors
          setImage(img);
        };
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
    
    // Update colors state AFTER processing to avoid triggering re-render
    setColors(updatedColors);
    currentColors.current = updatedColors;
  };

  // Copy image to clipboard
  const copyToClipboard = async () => {
    if (!canvasRef.current) return;

    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
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
    setResolution(1024);
    setMaxColors(7);
    setPixelatedImage(null);
    setColors([]);
    setSelectedColor('#000000');
    setIsDrawing(false);
    setEditingColorIndex(null);
    shouldRecalculateColors.current = true;
    currentColors.current = [];
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    // Reload default image after a brief delay to ensure state is reset
    setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        shouldRecalculateColors.current = true;
        setImage(img);
      };
      img.onerror = (e) => {
        console.error('Failed to load default sock image:', e);
      };
      img.src = '/images/default-sock.png';
    }, 100);
  };

  // Sync currentColors ref with colors state
  useEffect(() => {
    currentColors.current = colors;
  }, [colors]);

  // Set flag to recalculate colors when maxColors changes
  useEffect(() => {
    if (image && colors.length > 0) { // Only if we already have an image and colors
      shouldRecalculateColors.current = true;
    }
  }, [maxColors]);

  // Process image when parameters change
  useEffect(() => {
    if (image) {
      processImage();
    }
  }, [image, resolution, maxColors]);

  return (
    <div style={{ 
      display: 'flex', 
      gap: '20px', 
      padding: '20px', 
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#f0f0f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!image ? (
          <div 
            style={{
              width: '600px',
              height: '400px',
              border: '3px dashed rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease'
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
          >
            <p style={{ textAlign: 'center', opacity: 0.7 }}>Click to upload or drag and drop an image</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{ 
                imageRendering: 'pixelated',
                cursor: 'crosshair',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                backgroundColor: '#000000'
              }}
            />
          </div>
        )}
      </div>

      <div style={{ 
        width: '320px', 
        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '12px', 
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Sock Designer</h2>
        
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Resolution</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="640"
              max="1024"
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '14px' }}>{resolution}px</span>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Max Colors</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="3"
              max="7"
              value={maxColors}
              onChange={(e) => setMaxColors(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '14px' }}>{maxColors} colors</span>
          </div>
        </div>

        {colors.length > 0 && (
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Color Palette</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '10px' }}>
              {colors.map((color, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <div
                    style={{ 
                      backgroundColor: color,
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: selectedColor === color ? '3px solid #4a9eff' : '2px solid rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
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
                      cursor: 'pointer',
                      opacity: 0.8
                    }}
                    title="Edit color"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Actions</h3>
          <button
            onClick={removeBackground}
            disabled={!pixelatedImage}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: pixelatedImage ? '#4a9eff' : '#333',
              color: '#fff',
              cursor: pixelatedImage ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: pixelatedImage ? 1 : 0.5,
              transform: 'scale(1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Remove Background
          </button>
          <button
            onClick={copyToClipboard}
            disabled={!pixelatedImage}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: pixelatedImage ? '#4a9eff' : '#333',
              color: '#fff',
              cursor: pixelatedImage ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: pixelatedImage ? 1 : 0.5,
              transform: 'scale(1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Copy to Clipboard
          </button>
          <button
            onClick={downloadImage}
            disabled={!pixelatedImage}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: pixelatedImage ? '#4a9eff' : '#333',
              color: '#fff',
              cursor: pixelatedImage ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              opacity: pixelatedImage ? 1 : 0.5,
              transform: 'scale(1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Download PNG
          </button>
          <button
            onClick={resetComponent}
            style={{
              padding: '10px 16px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              transform: 'scale(1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}