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
  
  // Selection State
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const mouseDownPos = useRef({ x: 0, y: 0 });

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

    // Draw Grid (XZ Plane)
    const gridSize = 10;
    const gridStep = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'; // Very subtle slate

    ctx.beginPath();
    for (let i = -gridSize; i <= gridSize; i += gridStep) {
        // Lines parallel to Z-axis (varying X)
        const p1 = project({ id: 'g1', x: i, y: 0, z: -gridSize }, width, height);
        const p2 = project({ id: 'g2', x: i, y: 0, z: gridSize }, width, height);
        
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        // Lines parallel to X-axis (varying Z)
        const p3 = project({ id: 'g3', x: -gridSize, y: 0, z: i }, width, height);
        const p4 = project({ id: 'g4', x: gridSize, y: 0, z: i }, width, height);
        
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
    }
    ctx.stroke();

    // Draw Axes
    const axisLength = 3;
    const origin: Point3D = { id: 'origin', x: 0, y: 0, z: 0 };
    const xAxis: Point3D = { id: 'axis-x', x: axisLength, y: 0, z: 0 };
    const yAxis: Point3D = { id: 'axis-y', x: 0, y: axisLength, z: 0 };
    const zAxis: Point3D = { id: 'axis-z', x: 0, y: 0, z: axisLength };

    const pOrigin = project(origin, width, height);
    const pX = project(xAxis, width, height);
    const pY = project(yAxis, width, height);
    const pZ = project(zAxis, width, height);

    ctx.lineWidth = 2;
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // X Axis - Red
    ctx.beginPath();
    ctx.moveTo(pOrigin.x, pOrigin.y);
    ctx.lineTo(pX.x, pX.y);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.fillText('X', pX.x + 10, pX.y);

    // Y Axis - Green
    ctx.beginPath();
    ctx.moveTo(pOrigin.x, pOrigin.y);
    ctx.lineTo(pY.x, pY.y);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)'; // Green
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.fillText('Y', pY.x, pY.y - 12);

    // Z Axis - Blue
    ctx.beginPath();
    ctx.moveTo(pOrigin.x, pOrigin.y);
    ctx.lineTo(pZ.x, pZ.y);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'; // Blue
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('Z', pZ.x + 10, pZ.y);

    // Reset Text Align
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

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
    let selectedProj = null;
    let selectedPointData = null;

    scene.points.forEach(p => {
        const proj = projectedPoints.get(p.id);
        if (proj) {
            // If this is the selected point, save it for drawing last (on top)
            if (p.id === selectedPointId) {
                selectedProj = proj;
                selectedPointData = p;
                return; 
            }

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

    // Draw Selected Point Highlight & Tooltip (Top Layer)
    if (selectedProj && selectedPointData) {
        const p = selectedPointData as Point3D;
        const proj = selectedProj;

        // Highlight Glow
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.3)'; // Blue glow
        ctx.fill();
        ctx.strokeStyle = '#38bdf8'; // Blue stroke
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8'; 
        ctx.fill();

        // Tooltip Background
        const labelText = `${p.label || p.id}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
        ctx.font = 'bold 12px Inter';
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const padding = 6;
        const boxHeight = 24;
        const boxX = proj.x + 14;
        const boxY = proj.y - 12;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Dark slate bg
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, textWidth + padding * 2, boxHeight, 4);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tooltip Text
        ctx.fillStyle = '#38bdf8';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, boxX + padding, boxY + boxHeight / 2);
        
        // Reset defaults
        ctx.textBaseline = 'alphabetic';
    }
  };

  // Render Loop
  useEffect(() => {
    requestAnimationFrame(draw);
  }, [scene, rotation, scale, selectedPointId]);

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
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

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);

    // Calculate distance moved to distinguish click from drag
    const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.current.x, 2) + 
        Math.pow(e.clientY - mouseDownPos.current.y, 2)
    );

    // If movement is minimal, treat as click
    if (moveDist < 5) {
        handleCanvasClick(e);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Hit Test logic
    let closestId: string | null = null;
    let minDist = 20; // Click radius threshold
    
    // Canvas dimensions inside the component might differ from client rect due to scaling/dpr
    // but here we used clientWidth/Height for canvas.width/height, so they match 1:1 CSS pixels.
    const w = canvas.width;
    const h = canvas.height;
    
    scene.points.forEach(p => {
        const proj = project(p, w, h);
        const dx = x - proj.x;
        const dy = y - proj.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < minDist) {
            minDist = dist;
            closestId = p.id;
        }
    });
    
    setSelectedPointId(closestId); // Select or deselect
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
      <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur text-xs text-slate-300 p-3 rounded-lg border border-slate-700 shadow-xl pointer-events-none">
        <h3 className="font-bold text-blue-400 mb-1">CONTROLS</h3>
        <div className="flex items-center gap-2 mb-1">
            <span className="w-4 text-center">🖱️</span> <span>Left Click + Drag to Rotate</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
            <span className="w-4 text-center">📜</span> <span>Scroll to Zoom</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="w-4 text-center">👆</span> <span>Click point for details</span>
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