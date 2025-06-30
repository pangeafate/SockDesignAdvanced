'use client'

import React, { useState, useRef, useEffect } from 'react'

interface SockColors {
  body: string
  heel: string
  toe: string
}

export default function SockDesigner() {
  const [colors, setColors] = useState<SockColors>({
    body: '#4A90E2',
    heel: '#D0021B',
    toe: '#7ED321'
  })

  const sideViewCanvasRef = useRef<HTMLCanvasElement>(null)
  const bottomViewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Draw side view of sock
  const drawSideView = (canvas: HTMLCanvasElement, colors: SockColors) => {
    const ctx = canvas.getContext('2d')!
    const width = canvas.width
    const height = canvas.height
    
    ctx.clearRect(0, 0, width, height)
    
    // Sock body (main part)
    ctx.fillStyle = colors.body
    ctx.fillRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6)
    
    // Heel
    ctx.fillStyle = colors.heel
    ctx.beginPath()
    ctx.arc(width * 0.15, height * 0.5, width * 0.12, 0, Math.PI, true)
    ctx.fill()
    
    // Toe
    ctx.fillStyle = colors.toe
    ctx.beginPath()
    ctx.arc(width * 0.85, height * 0.5, width * 0.12, Math.PI / 2, (3 * Math.PI) / 2)
    ctx.fill()
    
    // Cuff
    ctx.fillStyle = colors.body
    ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.15)
    
    // Add some styling details
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.7)
  }

  // Draw bottom view of sock
  const drawBottomView = (canvas: HTMLCanvasElement, colors: SockColors) => {
    const ctx = canvas.getContext('2d')!
    const width = canvas.width
    const height = canvas.height
    
    ctx.clearRect(0, 0, width, height)
    
    // Sock sole (body color)
    ctx.fillStyle = colors.body
    ctx.beginPath()
    ctx.ellipse(width * 0.5, height * 0.5, width * 0.4, height * 0.15, 0, 0, 2 * Math.PI)
    ctx.fill()
    
    // Heel area
    ctx.fillStyle = colors.heel
    ctx.beginPath()
    ctx.ellipse(width * 0.2, height * 0.5, width * 0.15, height * 0.12, 0, 0, 2 * Math.PI)
    ctx.fill()
    
    // Toe area
    ctx.fillStyle = colors.toe
    ctx.beginPath()
    ctx.ellipse(width * 0.8, height * 0.5, width * 0.15, height * 0.12, 0, 0, 2 * Math.PI)
    ctx.fill()
    
    // Add outline
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(width * 0.5, height * 0.5, width * 0.4, height * 0.15, 0, 0, 2 * Math.PI)
    ctx.stroke()
  }

  // Update drawings when colors change
  useEffect(() => {
    if (sideViewCanvasRef.current) {
      drawSideView(sideViewCanvasRef.current, colors)
    }
    if (bottomViewCanvasRef.current) {
      drawBottomView(bottomViewCanvasRef.current, colors)
    }
  }, [colors])

  // Initialize canvases
  useEffect(() => {
    if (sideViewCanvasRef.current) {
      sideViewCanvasRef.current.width = 300
      sideViewCanvasRef.current.height = 200
      drawSideView(sideViewCanvasRef.current, colors)
    }
    if (bottomViewCanvasRef.current) {
      bottomViewCanvasRef.current.width = 300
      bottomViewCanvasRef.current.height = 150
      drawBottomView(bottomViewCanvasRef.current, colors)
    }
  }, [])

  const handleColorChange = (part: keyof SockColors, color: string) => {
    setColors(prev => ({ ...prev, [part]: color }))
  }

  const resetColors = () => {
    setColors({
      body: '#4A90E2',
      heel: '#D0021B',
      toe: '#7ED321'
    })
  }

  const downloadDesign = () => {
    // Create a combined canvas for export
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = 620
    exportCanvas.height = 400
    const ctx = exportCanvas.getContext('2d')!
    
    // White background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    
    // Add title
    ctx.fillStyle = 'black'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Sock Design', exportCanvas.width / 2, 30)
    
    // Draw side view
    if (sideViewCanvasRef.current) {
      ctx.drawImage(sideViewCanvasRef.current, 10, 50)
    }
    
    // Draw bottom view
    if (bottomViewCanvasRef.current) {
      ctx.drawImage(bottomViewCanvasRef.current, 320, 100)
    }
    
    // Add color legend
    ctx.font = '14px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('Colors:', 10, 280)
    
    const legendY = 300
    const swatchSize = 20
    
    ctx.fillStyle = colors.body
    ctx.fillRect(10, legendY, swatchSize, swatchSize)
    ctx.fillStyle = 'black'
    ctx.fillText(`Body: ${colors.body}`, 40, legendY + 15)
    
    ctx.fillStyle = colors.heel
    ctx.fillRect(10, legendY + 30, swatchSize, swatchSize)
    ctx.fillStyle = 'black'
    ctx.fillText(`Heel: ${colors.heel}`, 40, legendY + 45)
    
    ctx.fillStyle = colors.toe
    ctx.fillRect(10, legendY + 60, swatchSize, swatchSize)
    ctx.fillStyle = 'black'
    ctx.fillText(`Toe: ${colors.toe}`, 40, legendY + 75)
    
    // Download
    const link = document.createElement('a')
    link.download = 'sock-design.png'
    link.href = exportCanvas.toDataURL()
    link.click()
  }

  const allColors = Object.values(colors)

  return (
    <div className="sock-designer">
      <h2>Design Your Sock Colors</h2>
      <p>Customize the colors for different parts of your sock and see the preview</p>

      <div className="color-controls">
        <div className="color-control">
          <label htmlFor="bodyColor">Main Body Color</label>
          <input
            id="bodyColor"
            type="color"
            value={colors.body}
            onChange={(e) => handleColorChange('body', e.target.value)}
          />
          <div style={{ fontSize: '0.8rem', marginTop: '5px', color: '#666' }}>
            {colors.body}
          </div>
        </div>

        <div className="color-control">
          <label htmlFor="heelColor">Heel Color</label>
          <input
            id="heelColor"
            type="color"
            value={colors.heel}
            onChange={(e) => handleColorChange('heel', e.target.value)}
          />
          <div style={{ fontSize: '0.8rem', marginTop: '5px', color: '#666' }}>
            {colors.heel}
          </div>
        </div>

        <div className="color-control">
          <label htmlFor="toeColor">Toe Color</label>
          <input
            id="toeColor"
            type="color"
            value={colors.toe}
            onChange={(e) => handleColorChange('toe', e.target.value)}
          />
          <div style={{ fontSize: '0.8rem', marginTop: '5px', color: '#666' }}>
            {colors.toe}
          </div>
        </div>
      </div>

      <div className="sock-views">
        <div className="sock-view">
          <h3>Side View</h3>
          <canvas
            ref={sideViewCanvasRef}
            style={{ border: '1px solid #ddd', borderRadius: '8px' }}
          />
        </div>

        <div className="sock-view">
          <h3>Bottom View</h3>
          <canvas
            ref={bottomViewCanvasRef}
            style={{ border: '1px solid #ddd', borderRadius: '8px' }}
          />
        </div>
      </div>

      <div className="color-palette">
        <h4 style={{ width: '100%', textAlign: 'center', marginBottom: '10px' }}>
          Color Palette
        </h4>
        {allColors.map((color, index) => (
          <div
            key={index}
            className="color-swatch"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="buttons" style={{ justifyContent: 'center', marginTop: '20px' }}>
        <button onClick={resetColors} className="btn btn-secondary">
          Reset Colors
        </button>
        <button onClick={downloadDesign} className="btn btn-success">
          Download PNG
        </button>
      </div>
    </div>
  )
} 