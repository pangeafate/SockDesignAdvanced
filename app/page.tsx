'use client';

import { useState } from 'react';
import PictureDesigner from './components/PictureDesigner';
import SockDesigner from './components/SockDesigner';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picture' | 'sock'>('picture');

  return (
    <div className="container">
      <div className="header">
        <h1>Knitting Socks Designer</h1>
        <p>Create beautiful patterns and color designs for your knitting projects</p>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'picture' ? 'active' : ''}`}
          onClick={() => setActiveTab('picture')}
        >
          Picture Design
        </button>
        <button
          className={`tab-button ${activeTab === 'sock' ? 'active' : ''}`}
          onClick={() => setActiveTab('sock')}
        >
          Sock Color Design
        </button>
      </div>

      <div style={{ display: activeTab === 'picture' ? 'block' : 'none' }}>
        <PictureDesigner />
      </div>
      <div style={{ display: activeTab === 'sock' ? 'block' : 'none' }}>
        <SockDesigner />
      </div>
    </div>
  );
} 