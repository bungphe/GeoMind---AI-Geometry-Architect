import React, { useRef, useEffect, useState } from 'react';
import { GeometryScene, Point3D } from '../types';

interface GeometryCanvasProps {
  scene: GeometryScene;
}

const GeometryCanvas: React.FC<GeometryCanvasProps> = ({ scene }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Camera State
  const [rotation, setRotation] = useState({ x: -0.5, y: 0.5 }); // Radians
  const [scale, setScale] = useState(100); // Zoom level
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // 3D Projection Logic
  const project = (point: Point3D, width: number, height: number) => {
    // 1. Rotate around Y axis
    let x = point.x * Math.cos(rotation.y) - point.z * Math.sin(rotation.y);
    let z = point.x * Math.sin(rotation.y) + point.z * Math.cos(rotation.y);
    let y = point.y;

    // 2. Rotate around X axis
    let yNew = y * Math.cos(rotation.x) - z * Math.sin(rotation.x);
    let zNew = y * Math.sin(rotation.x) + z * Math.cos(rotation.x);
    y = yNew;
    z = zNew;

    // 3. Perspective Projection
    // Camera distance constant
    const d = 4;
    const factor = scale / (d - z * 0.1); // Simple weak perspective

    return {
      x: x * factor + width / 2,
      y: -y * factor + height / 2, // Invert Y for canvas coords
      scale: factor,
      zIndex: z
    };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Resize
    const container = containerRef.current;
    if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    const { width, height } = canvas;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw Grid (Optional Ground Plane helper)
    // Only if scene is empty or simple? No, always helpful.
    // Let's draw a subtle floor grid
    /* 
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    // ... complicated grid math omitted for brevity/style
    */

    // Project all points first
    const projectedPoints = new Map();
    scene.points.forEach(p => {
        projectedPoints.set(p.id, project(p, width, height));
    });

    // Draw Segments
    scene.segments.forEach(seg => {
        const p1 = projectedPoints.get(seg.sourceId);
        const p2 = projectedPoints.get(seg.targetId);

        if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            ctx.strokeStyle = '#94a3b8'; // Default line color
            ctx.lineWidth = 1.5;

            if (seg.style === 'dashed') {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = '#475569'; // Dimmer for hidden
            } else {
                ctx.setLineDash([]);
                ctx.strokeStyle = '#e2e8f0'; // Bright for visible
            }
            ctx.stroke();
        }
    });

    // Draw Points
    scene.points.forEach(p => {
        const proj = projectedPoints.get(p.id);
        if (proj) {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#facc15'; // Yellow dots
            ctx.fill();
            
            // Labels
            if (p.label) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px Inter';
                ctx.fillText(p.label, proj.x + 8, proj.y - 8);
            }
        }
    });
  };

  // Render Loop
  useEffect(() => {
    requestAnimationFrame(draw);
  }, [scene, rotation, scale]);

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    setRotation(prev => ({
        x: prev.x + deltaY * 0.01,
        y: prev.y + deltaX * 0.01
    }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    setScale(prev => Math.max(20, Math.min(500, prev - e.deltaY * 0.1)));
  };

  return (
    <div 
        ref={containerRef} 
        className="relative w-full h-full bg-[#0b1120] overflow-hidden cursor-move select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Overlay Controls Info */}
      <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur text-xs text-slate-300 p-3 rounded-lg border border-slate-700 shadow-xl">
        <h3 className="font-bold text-blue-400 mb-1">CONTROLS</h3>
        <div className="flex items-center gap-2 mb-1">
            <span className="w-4 text-center">🖱️</span> <span>Left Click + Drag to Rotate</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="w-4 text-center">📜</span> <span>Scroll to Zoom</span>
        </div>
      </div>

      {/* Axis Helper (Bottom Right) */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
          <div className="text-[10px] text-slate-500 font-mono">
            Rot X: {rotation.x.toFixed(2)} <br/>
            Rot Y: {rotation.y.toFixed(2)}
          </div>
      </div>
    </div>
  );
};

export default GeometryCanvas;