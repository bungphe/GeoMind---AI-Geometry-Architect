import React, { useRef, useEffect, useState } from 'react';
import { Ruler, MousePointer2 } from 'lucide-react';
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
  
  // Measurement Tool State
  const [isMeasurementMode, setIsMeasurementMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<string[]>([]);
  
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

  const getDistance = (p1: Point3D, p2: Point3D) => {
      return Math.sqrt(
          Math.pow(p2.x - p1.x, 2) + 
          Math.pow(p2.y - p1.y, 2) + 
          Math.pow(p2.z - p1.z, 2)
      );
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

    // --- Measurement Tool Drawing Layer ---
    if (measurePoints.length > 0) {
        const p1Data = scene.points.find(p => p.id === measurePoints[0]);
        const p2Data = measurePoints.length > 1 ? scene.points.find(p => p.id === measurePoints[1]) : null;

        const proj1 = p1Data ? projectedPoints.get(p1Data.id) : null;
        const proj2 = p2Data ? projectedPoints.get(p2Data.id) : null;

        // Draw Line between measurement points
        if (proj1 && proj2 && p1Data && p2Data) {
             ctx.beginPath();
             ctx.moveTo(proj1.x, proj1.y);
             ctx.lineTo(proj2.x, proj2.y);
             ctx.strokeStyle = '#06b6d4'; // Cyan-500
             ctx.setLineDash([4, 4]);
             ctx.lineWidth = 2;
             ctx.stroke();
             ctx.setLineDash([]); // Reset dash

             // Draw Distance Label at Midpoint
             const midX = (proj1.x + proj2.x) / 2;
             const midY = (proj1.y + proj2.y) / 2;
             const dist = getDistance(p1Data, p2Data).toFixed(2);
             
             ctx.font = 'bold 12px Inter';
             const textMetrics = ctx.measureText(dist);
             const padding = 6;
             
             // Badge Background
             ctx.fillStyle = '#083344'; // Cyan-950
             ctx.fillRect(midX - textMetrics.width/2 - padding, midY - 10, textMetrics.width + padding*2, 20);
             ctx.strokeStyle = '#06b6d4';
             ctx.lineWidth = 1;
             ctx.strokeRect(midX - textMetrics.width/2 - padding, midY - 10, textMetrics.width + padding*2, 20);
             
             // Badge Text
             ctx.fillStyle = '#22d3ee'; // Cyan-400
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText(dist, midX, midY);
             ctx.textAlign = 'left';
             ctx.textBaseline = 'alphabetic';
        }

        // Draw Measurement Highlights (Cyan Rings)
        [proj1, proj2].forEach(proj => {
            if (proj) {
                ctx.beginPath();
                ctx.arc(proj.x, proj.y, 10, 0, Math.PI * 2);
                ctx.strokeStyle = '#22d3ee'; // Cyan-400
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

    // Draw Points
    let selectedProj = null;
    let selectedPointData = null;

    scene.points.forEach(p => {
        const proj = projectedPoints.get(p.id);
        if (proj) {
            // If this is the selected point (Normal Mode), save it for drawing last (on top)
            if (p.id === selectedPointId && !isMeasurementMode) {
                selectedProj = proj;
                selectedPointData = p;
                return; 
            }

            // Standard Point
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = measurePoints.includes(p.id) ? '#22d3ee' : '#facc15'; // Cyan if measuring, else Yellow
            ctx.fill();
            
            // Labels
            if (p.label) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px Inter';
                ctx.fillText(p.label, proj.x + 8, proj.y - 8);
            }
        }
    });

    // Draw Selected Point Highlight & Tooltip (Top Layer - Normal Mode)
    if (selectedProj && selectedPointData) {
        const p = selectedPointData as Point3D;
        const proj = selectedProj;

        // 1. Outer Glow (Gradient)
        const glowRadius = 14;
        const gradient = ctx.createRadialGradient(proj.x, proj.y, 4, proj.x, proj.y, glowRadius);
        gradient.addColorStop(0, 'rgba(236, 72, 153, 0.6)'); // Pink-500
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
        
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 2. Selection Ring
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#f472b6'; // Pink-400
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Inner Dot (Distinct from yellow points)
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#db2777'; // Pink-600
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 4. Tooltip Configuration
        const labelText = `${p.label || p.id}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
        ctx.font = '600 13px Inter'; // Semi-bold
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const paddingX = 10;
        const paddingY = 8;
        const boxHeight = 32;
        
        // Offset tooltip
        const offsetDist = 20;
        const boxX = proj.x + offsetDist;
        const boxY = proj.y - offsetDist - boxHeight / 2;

        // Connecting Leader Line
        ctx.beginPath();
        ctx.moveTo(proj.x + 6, proj.y - 6); // Edge of outer ring
        ctx.lineTo(boxX, boxY + boxHeight / 2); // To box
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tooltip Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        // Tooltip Background
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'; // Slate-800
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(boxX, boxY, textWidth + paddingX * 2, boxHeight, 6);
        } else {
            ctx.rect(boxX, boxY, textWidth + paddingX * 2, boxHeight);
        }
        ctx.fill();
        ctx.restore(); // Clear shadow for stroke/text

        // Tooltip Border
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tooltip Text
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, boxX + paddingX, boxY + boxHeight / 2);
        
        // Cleanup
        ctx.textBaseline = 'alphabetic';
    }
  };

  // Render Loop
  useEffect(() => {
    requestAnimationFrame(draw);
  }, [scene, rotation, scale, selectedPointId, measurePoints, isMeasurementMode]);

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
    
    if (closestId) {
        if (isMeasurementMode) {
            setMeasurePoints(prev => {
                // If we already have 2 points, clicking a 3rd resets the selection to just the new one
                if (prev.length === 2) return [closestId];
                // Prevent adding same point twice
                if (prev.includes(closestId)) return prev;
                return [...prev, closestId];
            });
        } else {
            setSelectedPointId(closestId);
        }
    } else {
        // Clicked empty space
        if (!isMeasurementMode) {
            setSelectedPointId(null);
        }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    setScale(prev => Math.max(20, Math.min(500, prev - e.deltaY * 0.1)));
  };

  const toggleMeasurementMode = () => {
      const newMode = !isMeasurementMode;
      setIsMeasurementMode(newMode);
      setMeasurePoints([]); // Reset points when toggling
      if (newMode) {
          setSelectedPointId(null); // Clear normal selection when entering measure mode
      }
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
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
          {/* Instructions Panel */}
          <div className="bg-slate-800/80 backdrop-blur text-xs text-slate-300 p-3 rounded-lg border border-slate-700 shadow-xl">
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

          {/* Tools Panel (Interactive) */}
          <div className="bg-slate-800/80 backdrop-blur p-1.5 rounded-lg border border-slate-700 shadow-xl self-start pointer-events-auto flex gap-1">
            <button 
                onClick={() => {
                    setIsMeasurementMode(false);
                    setMeasurePoints([]);
                    setSelectedPointId(null);
                }}
                className={`p-2 rounded transition-colors ${!isMeasurementMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                title="Select Mode"
            >
                <MousePointer2 size={16} />
            </button>
            <button 
                onClick={toggleMeasurementMode}
                className={`p-2 rounded transition-colors ${isMeasurementMode ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                title="Measure Distance"
            >
                <Ruler size={16} />
            </button>
          </div>
          
          {/* Active Tool Instruction */}
          {isMeasurementMode && (
              <div className="bg-cyan-950/80 backdrop-blur text-xs text-cyan-200 px-3 py-2 rounded-lg border border-cyan-800 shadow-xl self-start animate-in fade-in slide-in-from-left-2">
                Select 2 points to measure distance
                {measurePoints.length > 0 && ` (${measurePoints.length}/2 selected)`}
              </div>
          )}
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