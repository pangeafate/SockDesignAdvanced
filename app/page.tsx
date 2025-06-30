'use client'

import React, { useState } from 'react'
import PictureDesigner from './components/PictureDesigner'
import SockDesigner from './components/SockDesigner'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picture' | 'sock'>('picture')

  return (
    <div className="container">
      <div className="header">
        <h1>Knitting Socks Designer Advanced</h1>
        <p>Create beautiful patterns and color schemes for your knitting projects</p>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'picture' ? 'active' : ''}`}
          onClick={() => setActiveTab('picture')}
        >
          Picture Design
        </button>
        <button 
          className={`tab ${activeTab === 'sock' ? 'active' : ''}`}
          onClick={() => setActiveTab('sock')}
        >
          Sock Color Design
        </button>
      </div>

      <div className="designer-container">
        {activeTab === 'picture' ? <PictureDesigner /> : <SockDesigner />}
      </div>
    </div>
  )
} 