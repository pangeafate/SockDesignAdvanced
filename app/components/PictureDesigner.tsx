'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface LabColor {
  l: number;
  a: number;
  b: number;
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
  const [useDithering, setUseDithering] = useState(true);
  const [enhanceEdges, setEnhanceEdges] = useState(true);
  const [history, setHistory] = useState<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save current state to history
  const saveToHistory = (imageData: ImageData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndexRef.current + 1);
      newHistory.push(imageData);
      historyIndexRef.current = newHistory.length - 1;
      return newHistory;
    });
  };

  // Undo last action
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      historyIndexRef.current -= 1;
      const previousState = history[historyIndexRef.current];
      ctx.putImageData(previousState, 0, 0);
      setPixelatedImage(previousState);
    }
  }, [history]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  // Convert RGB to LAB color space for perceptual color matching
  const rgbToLab = (color: Color): LabColor => {
    // Normalize RGB values
    let r = color.r / 255;
    let g = color.g / 255;
    let b = color.b / 255;

    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ
    const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
    const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
    const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;

    // Normalize for D65 illuminant
    const xn = 95.047;
    const yn = 100.000;
    const zn = 108.883;

    const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn + 16/116);
    const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn + 16/116);
    const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn + 16/116);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  };

  // Perceptual color distance using LAB color space
  const perceptualColorDistance = (c1: Color, c2: Color): number => {
    const lab1 = rgbToLab(c1);
    const lab2 = rgbToLab(c2);
    
    return Math.sqrt(
      Math.pow(lab1.l - lab2.l, 2) + 
      Math.pow(lab1.a - lab2.a, 2) + 
      Math.pow(lab1.b - lab2.b, 2)
    );
  };

  // Area-averaging downsampling for better pixelization
  const areaAverageDownsample = (sourceData: ImageData, targetWidth: number, targetHeight: number): ImageData => {
    const sourceWidth = sourceData.width;
    const sourceHeight = sourceData.height;
    const targetData = new ImageData(targetWidth, targetHeight);
    
    const xRatio = sourceWidth / targetWidth;
    const yRatio = sourceHeight / targetHeight;
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        // Calculate source pixel range
        const sx1 = Math.floor(x * xRatio);
        const sx2 = Math.ceil((x + 1) * xRatio);
        const sy1 = Math.floor(y * yRatio);
        const sy2 = Math.ceil((y + 1) * yRatio);
        
        // Average all contributing source pixels
        for (let sy = sy1; sy < sy2 && sy < sourceHeight; sy++) {
          for (let sx = sx1; sx < sx2 && sx < sourceWidth; sx++) {
            const idx = (sy * sourceWidth + sx) * 4;
            const alpha = sourceData.data[idx + 3];
            if (alpha > 0) {
              r += sourceData.data[idx] * alpha;
              g += sourceData.data[idx + 1] * alpha;
              b += sourceData.data[idx + 2] * alpha;
              a += alpha;
              count += alpha;
            }
          }
        }
        
        const targetIdx = (y * targetWidth + x) * 4;
        if (count > 0) {
          targetData.data[targetIdx] = Math.round(r / count);
          targetData.data[targetIdx + 1] = Math.round(g / count);
          targetData.data[targetIdx + 2] = Math.round(b / count);
          targetData.data[targetIdx + 3] = Math.round(a / (sx2 - sx1) / (sy2 - sy1));
        }
      }
    }
    
    return targetData;
  };

  // Edge enhancement filter
  const enhanceEdgesFilter = (imageData: ImageData): ImageData => {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const data = imageData.data;
    const outData = output.data;
    
    // Sharpening kernel
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        outData[idx] = Math.max(0, Math.min(255, r));
        outData[idx + 1] = Math.max(0, Math.min(255, g));
        outData[idx + 2] = Math.max(0, Math.min(255, b));
        outData[idx + 3] = data[idx + 3];
      }
    }
    
    // Copy edges
    for (let i = 0; i < data.length; i++) {
      if (outData[i] === 0 && (i % 4) !== 3) {
        outData[i] = data[i];
      }
    }
    
    return output;
  };

  // Floyd-Steinberg dithering
  const floydSteinbergDither = (imageData: ImageData, palette: Color[]): void => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        if (data[idx + 3] < 128) continue; // Skip transparent pixels
        
        const oldColor: Color = {
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: data[idx + 3]
        };
        
        // Find closest palette color
        let minDist = Infinity;
        let closestColor = palette[0];
        
        for (const paletteColor of palette) {
          const dist = perceptualColorDistance(oldColor, paletteColor);
          if (dist < minDist) {
            minDist = dist;
            closestColor = paletteColor;
          }
        }
        
        // Apply closest color
        data[idx] = closestColor.r;
        data[idx + 1] = closestColor.g;
        data[idx + 2] = closestColor.b;
        
        // Calculate error
        const errorR = oldColor.r - closestColor.r;
        const errorG = oldColor.g - closestColor.g;
        const errorB = oldColor.b - closestColor.b;
        
        // Distribute error to neighboring pixels
        const distributeError = (dx: number, dy: number, factor: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = (ny * width + nx) * 4;
            if (data[nIdx + 3] > 128) { // Only to non-transparent pixels
              data[nIdx] = Math.max(0, Math.min(255, data[nIdx] + errorR * factor));
              data[nIdx + 1] = Math.max(0, Math.min(255, data[nIdx + 1] + errorG * factor));
              data[nIdx + 2] = Math.max(0, Math.min(255, data[nIdx + 2] + errorB * factor));
            }
          }
        };
        
        distributeError(1, 0, 7/16);
        distributeError(-1, 1, 3/16);
        distributeError(0, 1, 5/16);
        distributeError(1, 1, 1/16);
      }
    }
  };

  // Improved K-means with better initialization
  const quantizeColors = (imageData: ImageData, k: number): string[] => {
    const pixels: Color[] = [];
    const pixelCounts = new Map<string, number>();
    
    // Extract all pixels and count occurrences
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 128) {
        const pixel: Color = {
          r: imageData.data[i],
          g: imageData.data[i + 1],
          b: imageData.data[i + 2],
          a: imageData.data[i + 3]
        };
        pixels.push(pixel);
        
        const key = `${pixel.r},${pixel.g},${pixel.b}`;
        pixelCounts.set(key, (pixelCounts.get(key) || 0) + 1);
      }
    }

    if (pixels.length === 0) return [];

    // Initialize centroids using k-means++ for better starting positions
    const centroids: Color[] = [];
    
    // First centroid: choose randomly
    centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });
    
    // Remaining centroids: choose based on distance from existing ones
    for (let i = 1; i < k; i++) {
      const distances = pixels.map(pixel => {
        let minDist = Infinity;
        centroids.forEach(centroid => {
          const dist = perceptualColorDistance(pixel, centroid);
          minDist = Math.min(minDist, dist);
        });
        return minDist;
      });
      
      // Choose pixel with probability proportional to squared distance
      const sumDistances = distances.reduce((a, b) => a + b * b, 0);
      let random = Math.random() * sumDistances;
      let idx = 0;
      
      for (let j = 0; j < distances.length; j++) {
        random -= distances[j] * distances[j];
        if (random <= 0) {
          idx = j;
          break;
        }
      }
      
      centroids.push({ ...pixels[idx] });
    }

    // K-means iterations with perceptual color distance
    for (let iter = 0; iter < 30; iter++) {
      const clusters: Color[][] = Array(k).fill(null).map(() => []);
      const clusterWeights: number[][] = Array(k).fill(null).map(() => []);
      
      // Assign pixels to closest centroid
      pixels.forEach((pixel, pixelIdx) => {
        let minDist = Infinity;
        let closestCentroid = 0;
        
        centroids.forEach((centroid, i) => {
          const dist = perceptualColorDistance(pixel, centroid);
          if (dist < minDist) {
            minDist = dist;
            closestCentroid = i;
          }
        });
        
        clusters[closestCentroid].push(pixel);
        const key = `${pixel.r},${pixel.g},${pixel.b}`;
        clusterWeights[closestCentroid].push(pixelCounts.get(key) || 1);
      });

      // Update centroids with weighted average
      let changed = false;
      centroids.forEach((centroid, i) => {
        if (clusters[i].length > 0) {
          const totalWeight = clusterWeights[i].reduce((a, b) => a + b, 0);
          const newR = clusters[i].reduce((sum, p, idx) => sum + p.r * clusterWeights[i][idx], 0) / totalWeight;
          const newG = clusters[i].reduce((sum, p, idx) => sum + p.g * clusterWeights[i][idx], 0) / totalWeight;
          const newB = clusters[i].reduce((sum, p, idx) => sum + p.b * clusterWeights[i][idx], 0) / totalWeight;
          
          if (Math.abs(centroid.r - newR) > 1 || Math.abs(centroid.g - newG) > 1 || Math.abs(centroid.b - newB) > 1) {
            changed = true;
          }
          
          centroid.r = newR;
          centroid.g = newG;
          centroid.b = newB;
        }
      });
      
      if (!changed) break;
    }

    // Remove duplicate colors and sort by usage
    const uniqueColors = new Map<string, { color: Color, count: number }>();
    
    pixels.forEach(pixel => {
      let minDist = Infinity;
      let closestCentroid: Color = centroids[0];
      
      centroids.forEach(centroid => {
        const dist = perceptualColorDistance(pixel, centroid);
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = centroid;
        }
      });
      
      const key = `${Math.round(closestCentroid.r)},${Math.round(closestCentroid.g)},${Math.round(closestCentroid.b)}`;
      const existing = uniqueColors.get(key);
      if (existing) {
        existing.count++;
      } else {
        uniqueColors.set(key, { 
          color: {
            r: Math.round(closestCentroid.r),
            g: Math.round(closestCentroid.g),
            b: Math.round(closestCentroid.b),
            a: 255
          }, 
          count: 1 
        });
      }
    });

    // Sort by usage and return top k colors
    const sortedColors = Array.from(uniqueColors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, k)
      .map(item => item.color);

    return sortedColors.map(c => 
      `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`
    );
  };

  // Process image with improved algorithms
  const processImage = useCallback(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Draw original image to temp canvas
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    tempCtx.drawImage(image, 0, 0);
    
    let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Apply edge enhancement if enabled
    if (enhanceEdges && resolution < 64) {
      imageData = enhanceEdgesFilter(imageData);
    }
    
    // Calculate target dimensions
    const targetWidth = resolution;
    const targetHeight = Math.round((resolution * image.height) / image.width);
    
    // Apply area-averaging downsampling
    const downsampledData = areaAverageDownsample(imageData, targetWidth, targetHeight);
    
    // Set canvas dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Keep display size constant
    const displayWidth = 600;
    const displayHeight = Math.round((displayWidth * image.height) / image.width);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // Get color palette from downsampled image
    const palette = quantizeColors(downsampledData, maxColors);
    setColors(palette);
    
    // Convert palette to Color objects
    const paletteColors: Color[] = palette.map(hex => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
      a: 255
    }));
    
    // Apply dithering if enabled
    if (useDithering) {
      floydSteinbergDither(downsampledData, paletteColors);
    } else {
      // Simple color quantization without dithering
      const data = downsampledData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
          const pixel: Color = {
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: data[i + 3]
          };
          
          let minDist = Infinity;
          let closestColor = paletteColors[0];
          
          paletteColors.forEach(paletteColor => {
            const dist = perceptualColorDistance(pixel, paletteColor);
            if (dist < minDist) {
              minDist = dist;
              closestColor = paletteColor;
            }
          });
          
          data[i] = closestColor.r;
          data[i + 1] = closestColor.g;
          data[i + 2] = closestColor.b;
        }
      }
    }
    
    ctx.putImageData(downsampledData, 0, 0);
    setPixelatedImage(downsampledData);
  }, [image, resolution, maxColors, useDithering, enhanceEdges]);

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

  // Handle clipboard paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => setImage(img);
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, []);

  // Set up clipboard paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // Handle canvas painting
  const paintPixel = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !pixelatedImage) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    // Check bounds
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

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

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    paintPixel(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      paintPixel(e);
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        saveToHistory(imageData);
      }
    }
    setIsDrawing(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsDrawing(false);
  };

  // Remove selected color (make transparent)
  const removeSelectedColor = () => {
    if (!canvasRef.current || !pixelatedImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert selected hex color to RGB
    const selectedR = parseInt(selectedColor.slice(1, 3), 16);
    const selectedG = parseInt(selectedColor.slice(3, 5), 16);
    const selectedB = parseInt(selectedColor.slice(5, 7), 16);

    // Make all pixels of the selected color transparent
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === selectedR && data[i + 1] === selectedG && data[i + 2] === selectedB) {
        data[i + 3] = 0; // Make transparent
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setPixelatedImage(imageData);
    saveToHistory(imageData);
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
    saveToHistory(imageData);
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
    setResolution(32);
    setMaxColors(8);
    setPixelatedImage(null);
    setColors([]);
    setSelectedColor('#000000');
    setIsDrawing(false);
    setEditingColorIndex(null);
    setUseDithering(true);
    setEnhanceEdges(true);
    setHistory([]);
    historyIndexRef.current = -1;
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Save to history when pixelatedImage first becomes available
  useEffect(() => {
    if (pixelatedImage && historyIndexRef.current === -1) {
      saveToHistory(pixelatedImage);
    }
  }, [pixelatedImage]);

  // Process image when parameters change
  useEffect(() => {
    if (image) {
      processImage();
    }
  }, [image, processImage]);

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
            <p style={{ textAlign: 'center', opacity: 0.7 }}>
              Click to upload, drag and drop,<br/>or paste an image (Ctrl+V)
            </p>
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
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
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
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Knitting Pattern Designer</h2>
        
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Resolution</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="16"
              max="128"
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
              min="2"
              max="16"
              value={maxColors}
              onChange={(e) => setMaxColors(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '14px' }}>{maxColors} colors</span>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Quality Options</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useDithering}
              onChange={(e) => setUseDithering(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <span style={{ fontSize: '14px' }}>Use Dithering (smoother gradients)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enhanceEdges}
              onChange={(e) => setEnhanceEdges(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <span style={{ fontSize: '14px' }}>Enhance Edges (preserve details)</span>
          </label>
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
            onClick={removeSelectedColor}
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
            Remove Color
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
              opacity: pixelatedImage ? 1 : 0.5
            }}
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
              opacity: pixelatedImage ? 1 : 0.5
            }}
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
              transition: 'all 0.2s ease'
            }}
          >
            Reset
          </button>
          <p style={{ fontSize: '12px', opacity: 0.6, margin: '8px 0 0 0', textAlign: 'center' }}>
            Tip: Use Ctrl+Z (Cmd+Z on Mac) to undo
          </p>
        </div>
      </div>
    </div>
  );
}