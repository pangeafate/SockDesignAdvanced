'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

interface Color {
  r: number
  g: number
  b: number
  a: number
}

export default function PictureDesigner() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [pixelSize, setPixelSize] = useState(32)
  const [maxColors, setMaxColors] = useState(8)
  const [selectedColor, setSelectedColor] = useState<Color>({ r: 0, g: 0, b: 0, a: 255 })
  const [colors, setColors] = useState<Color[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const pixelatedCanvasRef = useRef<HTMLCanvasElement>(null)

  // Enhanced pixelization algorithm for knitting patterns
  const smartPixelize = useCallback((
    sourceCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement,
    pixelSize: number
  ) => {
    const sourceCtx = sourceCanvas.getContext('2d')!
    const targetCtx = targetCanvas.getContext('2d')!
    
    const sourceWidth = sourceCanvas.width
    const sourceHeight = sourceCanvas.height
    
    // Calculate target dimensions maintaining aspect ratio
    const aspectRatio = sourceWidth / sourceHeight
    const targetWidth = Math.floor(sourceWidth / pixelSize) * pixelSize
    const targetHeight = Math.floor(targetWidth / aspectRatio / pixelSize) * pixelSize
    
    targetCanvas.width = targetWidth
    targetCanvas.height = targetHeight
    
    const sourceData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight)
    const targetData = targetCtx.createImageData(targetWidth, targetHeight)
    
    const pixelsPerBlockX = sourceWidth / (targetWidth / pixelSize)
    const pixelsPerBlockY = sourceHeight / (targetHeight / pixelSize)
    
    // Process each pixel block
    for (let y = 0; y < targetHeight; y += pixelSize) {
      for (let x = 0; x < targetWidth; x += pixelSize) {
        // Sample area in source image
        const sourceX = Math.floor((x / targetWidth) * sourceWidth)
        const sourceY = Math.floor((y / targetHeight) * sourceHeight)
        const sourceEndX = Math.min(sourceX + pixelsPerBlockX, sourceWidth)
        const sourceEndY = Math.min(sourceY + pixelsPerBlockY, sourceHeight)
        
        // Enhanced sampling with edge detection and color weighting
        let totalWeight = 0
        let weightedR = 0, weightedG = 0, weightedB = 0, weightedA = 0
        let edgeStrength = 0
        
        // First pass: collect color data and detect edges
        const samples: Color[] = []
        for (let sy = sourceY; sy < sourceEndY; sy++) {
          for (let sx = sourceX; sx < sourceEndX; sx++) {
            const idx = (sy * sourceWidth + sx) * 4
            if (idx < sourceData.data.length) {
              const r = sourceData.data[idx]
              const g = sourceData.data[idx + 1]
              const b = sourceData.data[idx + 2]
              const a = sourceData.data[idx + 3]
              samples.push({ r, g, b, a })
              
              // Calculate edge strength using gradient
              if (sx > sourceX && sy > sourceY) {
                const prevIdx = ((sy - 1) * sourceWidth + (sx - 1)) * 4
                const dr = Math.abs(r - sourceData.data[prevIdx])
                const dg = Math.abs(g - sourceData.data[prevIdx + 1])
                const db = Math.abs(b - sourceData.data[prevIdx + 2])
                edgeStrength += (dr + dg + db) / 3
              }
            }
          }
        }
        
        // Second pass: weighted average with edge consideration
        const avgEdge = edgeStrength / samples.length
        for (const sample of samples) {
          // Give more weight to colors that are more common or near edges
          const luminance = 0.299 * sample.r + 0.587 * sample.g + 0.114 * sample.b
          const edgeWeight = avgEdge > 30 ? 1.5 : 1.0 // Boost edge pixels
          const contrastWeight = luminance > 128 ? 1.2 : 0.8 // Prefer higher contrast
          const weight = edgeWeight * contrastWeight
          
          weightedR += sample.r * weight
          weightedG += sample.g * weight
          weightedB += sample.b * weight
          weightedA += sample.a * weight
          totalWeight += weight
        }
        
        if (totalWeight > 0) {
          const avgR = Math.round(weightedR / totalWeight)
          const avgG = Math.round(weightedG / totalWeight)
          const avgB = Math.round(weightedB / totalWeight)
          const avgA = Math.round(weightedA / totalWeight)
          
          // Fill the pixel block with the calculated color
          for (let py = y; py < y + pixelSize && py < targetHeight; py++) {
            for (let px = x; px < x + pixelSize && px < targetWidth; px++) {
              const idx = (py * targetWidth + px) * 4
              targetData.data[idx] = avgR
              targetData.data[idx + 1] = avgG
              targetData.data[idx + 2] = avgB
              targetData.data[idx + 3] = avgA
            }
          }
        }
      }
    }
    
    targetCtx.putImageData(targetData, 0, 0)
  }, [])

  // K-means clustering for color quantization optimized for knitting
  const quantizeColors = useCallback((canvas: HTMLCanvasElement, maxColors: number): Color[] => {
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Extract unique colors with frequency counting
    const colorMap = new Map<string, { color: Color; count: number }>()
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      
      if (a > 0) { // Skip transparent pixels
        const key = `${r},${g},${b}`
        const existing = colorMap.get(key)
        if (existing) {
          existing.count++
        } else {
          colorMap.set(key, { color: { r, g, b, a }, count: 1 })
        }
      }
    }
    
    let colors = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count) // Sort by frequency
      .map(item => item.color)
    
    if (colors.length <= maxColors) {
      return colors
    }
    
    // Enhanced K-means with knitting-specific color selection
    const centroids: Color[] = []
    
    // Select initial centroids focusing on high-frequency and high-contrast colors
    const sortedByFrequency = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
    
    // Always include the most frequent color
    centroids.push(sortedByFrequency[0].color)
    
    // Add colors with maximum distance from existing centroids
    for (let i = 1; i < maxColors; i++) {
      let maxDistance = 0
      let bestColor = colors[0]
      
      for (const colorEntry of sortedByFrequency) {
        const color = colorEntry.color
        let minDistanceToExisting = Infinity
        
        for (const centroid of centroids) {
          const distance = Math.sqrt(
            Math.pow(color.r - centroid.r, 2) +
            Math.pow(color.g - centroid.g, 2) +
            Math.pow(color.b - centroid.b, 2)
          )
          minDistanceToExisting = Math.min(minDistanceToExisting, distance)
        }
        
        if (minDistanceToExisting > maxDistance) {
          maxDistance = minDistanceToExisting
          bestColor = color
        }
      }
      
      centroids.push(bestColor)
    }
    
    // Refine centroids with K-means iterations
    for (let iteration = 0; iteration < 10; iteration++) {
      const clusters: Color[][] = centroids.map(() => [])
      
      // Assign colors to nearest centroids
      for (const colorEntry of colorMap.values()) {
        const color = colorEntry.color
        let minDistance = Infinity
        let bestCluster = 0
        
        for (let j = 0; j < centroids.length; j++) {
          const centroid = centroids[j]
          const distance = Math.sqrt(
            Math.pow(color.r - centroid.r, 2) +
            Math.pow(color.g - centroid.g, 2) +
            Math.pow(color.b - centroid.b, 2)
          )
          
          if (distance < minDistance) {
            minDistance = distance
            bestCluster = j
          }
        }
        
        // Add color multiple times based on frequency for better clustering
        for (let k = 0; k < colorEntry.count; k++) {
          clusters[bestCluster].push(color)
        }
      }
      
      // Update centroids
      let changed = false
      for (let j = 0; j < centroids.length; j++) {
        if (clusters[j].length > 0) {
          const newR = Math.round(clusters[j].reduce((sum, c) => sum + c.r, 0) / clusters[j].length)
          const newG = Math.round(clusters[j].reduce((sum, c) => sum + c.g, 0) / clusters[j].length)
          const newB = Math.round(clusters[j].reduce((sum, c) => sum + c.b, 0) / clusters[j].length)
          
          if (newR !== centroids[j].r || newG !== centroids[j].g || newB !== centroids[j].b) {
            centroids[j] = { r: newR, g: newG, b: newB, a: 255 }
            changed = true
          }
        }
      }
      
      if (!changed) break
    }
    
    return centroids
  }, [])

  // Apply quantized colors to canvas
  const applyQuantization = useCallback((canvas: HTMLCanvasElement, colors: Color[]) => {
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) { // Skip transparent pixels
        const originalColor = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
        
        // Find closest color
        let minDistance = Infinity
        let closestColor = colors[0]
        
        for (const color of colors) {
          const distance = Math.sqrt(
            Math.pow(originalColor.r - color.r, 2) +
            Math.pow(originalColor.g - color.g, 2) +
            Math.pow(originalColor.b - color.b, 2)
          )
          
          if (distance < minDistance) {
            minDistance = distance
            closestColor = color
          }
        }
        
        data[i] = closestColor.r
        data[i + 1] = closestColor.g
        data[i + 2] = closestColor.b
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
  }, [])

  // Process image with enhanced algorithms
  const processImage = useCallback(async (img: HTMLImageElement) => {
    setIsProcessing(true)
    
    if (originalCanvasRef.current && pixelatedCanvasRef.current) {
      const originalCanvas = originalCanvasRef.current
      const pixelatedCanvas = pixelatedCanvasRef.current
      const originalCtx = originalCanvas.getContext('2d')!
      
      // Set original canvas size
      originalCanvas.width = img.width
      originalCanvas.height = img.height
      originalCtx.drawImage(img, 0, 0)
      
      // Apply smart pixelization
      smartPixelize(originalCanvas, pixelatedCanvas, pixelSize)
      
      // Extract and quantize colors
      const extractedColors = quantizeColors(pixelatedCanvas, maxColors)
      setColors(extractedColors)
      
      // Apply quantization
      applyQuantization(pixelatedCanvas, extractedColors)
      
      if (extractedColors.length > 0) {
        setSelectedColor(extractedColors[0])
      }
    }
    
    setIsProcessing(false)
  }, [pixelSize, maxColors, smartPixelize, quantizeColors, applyQuantization])

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const img = new Image()
            img.onload = () => {
              setImage(img)
              processImage(img)
            }
            img.src = URL.createObjectURL(file)
          }
          break
        }
      }
    }
    
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [processImage])

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const img = new Image()
      img.onload = () => {
        setImage(img)
        processImage(img)
      }
      img.src = URL.createObjectURL(file)
    }
  }

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const img = new Image()
        img.onload = () => {
          setImage(img)
          processImage(img)
        }
        img.src = URL.createObjectURL(file)
      }
    }
  }

  // Re-process when parameters change
  useEffect(() => {
    if (image) {
      processImage(image)
    }
  }, [image, pixelSize, maxColors, processImage])

  // Handle pixel editing
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pixelatedCanvasRef.current) return
    
    const canvas = pixelatedCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.floor((event.clientY - rect.top) * (canvas.height / rect.height))
    
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = `rgba(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b}, ${selectedColor.a / 255})`
    
    // Find the pixel block size and fill the entire block
    const blockSize = Math.floor(canvas.width / (canvas.width / pixelSize))
    const blockX = Math.floor(x / blockSize) * blockSize
    const blockY = Math.floor(y / blockSize) * blockSize
    
    ctx.fillRect(blockX, blockY, blockSize, blockSize)
  }

  // Download image
  const downloadImage = () => {
    if (pixelatedCanvasRef.current) {
      const link = document.createElement('a')
      link.download = 'knitting-pattern.png'
      link.href = pixelatedCanvasRef.current.toDataURL()
      link.click()
    }
  }

  // Remove background
  const removeBackground = () => {
    if (!pixelatedCanvasRef.current) return
    
    const canvas = pixelatedCanvasRef.current
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Get corner color as background
    const bgColor = { r: data[0], g: data[1], b: data[2] }
    const threshold = 30
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      const distance = Math.sqrt(
        Math.pow(r - bgColor.r, 2) +
        Math.pow(g - bgColor.g, 2) +
        Math.pow(b - bgColor.b, 2)
      )
      
      if (distance < threshold) {
        data[i + 3] = 0 // Make transparent
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
  }

  return (
    <div>
      <div className={`upload-area ${dragOver ? 'drag-over' : ''} ${image ? 'has-image' : ''}`}
           onDragOver={handleDragOver}
           onDragLeave={handleDragLeave}
           onDrop={handleDrop}
           onClick={() => fileInputRef.current?.click()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        {image ? (
          <div>
            <p>✓ Image loaded - Ready for processing</p>
            <p className="paste-hint">Drop another image, click to browse, or paste from clipboard (Ctrl+V)</p>
          </div>
        ) : (
          <div>
            <p>📸 Drop an image here, click to browse, or paste from clipboard (Ctrl+V)</p>
            <p className="paste-hint">Supports all common image formats</p>
          </div>
        )}
      </div>

      <div className="controls">
        <div className="control-group">
          <h4>Pixelization</h4>
          <div className="slider-container">
            <label htmlFor="pixelSize">Pixel Size: {pixelSize}px</label>
            <input
              id="pixelSize"
              type="range"
              min="8"
              max="64"
              value={pixelSize}
              onChange={(e) => setPixelSize(parseInt(e.target.value))}
              className="slider"
            />
          </div>
          <div className="slider-container">
            <label htmlFor="maxColors">Max Colors: {maxColors}</label>
            <input
              id="maxColors"
              type="range"
              min="2"
              max="16"
              value={maxColors}
              onChange={(e) => setMaxColors(parseInt(e.target.value))}
              className="slider"
            />
          </div>
        </div>

        <div className="control-group">
          <h4>Actions</h4>
          <div className="buttons">
            <button onClick={removeBackground} className="btn btn-secondary" disabled={!image}>
              Remove Background
            </button>
            <button onClick={downloadImage} className="btn btn-success" disabled={!image}>
              Download PNG
            </button>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#667eea' }}>
          <p>🧶 Processing image with enhanced knitting algorithm...</p>
        </div>
      )}

      {image && (
        <>
          <div className="canvas-container">
            <div className="canvas-wrapper">
              <h4>Original</h4>
              <canvas
                ref={originalCanvasRef}
                style={{ maxWidth: '300px', maxHeight: '300px' }}
              />
            </div>
            <div className="canvas-wrapper">
              <h4>Knitting Pattern</h4>
              <canvas
                ref={pixelatedCanvasRef}
                onClick={handleCanvasClick}
                style={{ maxWidth: '300px', maxHeight: '300px' }}
              />
            </div>
          </div>

          {colors.length > 0 && (
            <div className="color-palette">
              {colors.map((color, index) => (
                <div
                  key={index}
                  className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                  style={{
                    backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`
                  }}
                  onClick={() => setSelectedColor(color)}
                  title={`RGB(${color.r}, ${color.g}, ${color.b})`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
} 