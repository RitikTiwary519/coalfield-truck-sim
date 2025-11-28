import React, { useRef, useState, useEffect } from 'react';
import { Node, Edge, Router, Truck, EditorMode } from '../types';
import { Truck as TruckIcon, Router as RouterIcon, Wifi, XCircle, AlertTriangle, Trash2 } from 'lucide-react';

interface SimulationMapProps {
  nodes: Map<string, Node>;
  edges: Edge[];
  routers: Router[];
  trucks: Truck[];
  mode: EditorMode;
  onAddNode: (x: number, y: number) => void;
  onAddEdge: (nodeId: string) => void;
  onAddRouter: (x: number, y: number) => void;
  onToggleClosure: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteRouter: (routerId: string) => void;
  selectedNodeId: string | null;
  className?: string;
}

export const SimulationMap: React.FC<SimulationMapProps> = ({
  nodes,
  edges,
  routers,
  trucks,
  mode,
  onAddNode,
  onAddEdge,
  onAddRouter,
  onToggleClosure,
  onDeleteNode,
  onDeleteEdge,
  onDeleteRouter,
  selectedNodeId,
  className
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  
  // Fit map to window
  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current?.parentElement) {
        setDimensions({
          w: svgRef.current.parentElement.clientWidth,
          h: svgRef.current.parentElement.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'add_node') {
      onAddNode(x, y);
    } else if (mode === 'add_router') {
      onAddRouter(x, y);
    }
  };

  const getNodeColor = (id: string) => {
    if (mode === 'delete') return '#f87171'; // red-400 indicating delete
    if (id === selectedNodeId) return '#3b82f6'; // blue-500
    return '#94a3b8'; // slate-400
  };

  const getEdgeColor = (edge: Edge) => {
    if (mode === 'delete') return '#f87171';
    if (edge.isClosed) return '#ef4444'; // red-500
    // Congestion gradient: Green -> Yellow -> Orange -> Red
    const usage = edge.currentLoad / edge.capacity;
    if (usage < 0.5) return '#22c55e'; // green-500
    if (usage < 0.8) return '#eab308'; // yellow-500
    if (usage < 1.0) return '#f97316'; // orange-500
    return '#b91c1c'; // red-700
  };

  return (
    <div className={`relative w-full h-full bg-slate-900 overflow-hidden ${className}`}>
      <svg
        ref={svgRef}
        width={dimensions.w}
        height={dimensions.h}
        onClick={handleSvgClick}
        className={`w-full h-full ${mode === 'delete' ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
          </marker>
        </defs>

        {/* Grid Background */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" className="pointer-events-none" />

        {/* Edges */}
        {edges.map(edge => {
          const start = nodes.get(edge.sourceId);
          const end = nodes.get(edge.targetId);
          if (!start || !end) return null;
          
          return (
            <g 
              key={edge.id} 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (mode === 'delete') onDeleteEdge(edge.id);
                else onToggleClosure(edge.id); 
              }} 
              className={`cursor-pointer hover:opacity-80 ${mode === 'delete' ? 'hover:stroke-red-500' : ''}`}
            >
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={getEdgeColor(edge)}
                strokeWidth={Math.max(2, 2 + (edge.currentLoad / edge.capacity) * 4)}
                markerEnd={mode === 'delete' ? undefined : "url(#arrowhead)"}
                strokeDasharray={mode === 'delete' ? "5,5" : undefined}
              />
              {/* Edge Label (Load) */}
              <text
                x={(start.x + end.x) / 2}
                y={(start.y + end.y) / 2 - 5}
                fill="#cbd5e1"
                fontSize="10"
                textAnchor="middle"
              >
                {edge.currentLoad}/{edge.capacity}
              </text>
              {edge.isClosed && (
                 <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 + 15} textAnchor="middle" fontSize="12">⛔</text>
              )}
            </g>
          );
        })}

        {/* Routers */}
        {routers.map(router => (
          <g 
            key={router.id}
            onClick={(e) => {
              e.stopPropagation();
              if (mode === 'delete') onDeleteRouter(router.id);
            }}
            className="cursor-pointer"
          >
             <circle 
               cx={router.x} 
               cy={router.y} 
               r={20} 
               fill={mode === 'delete' ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.1)"} 
               stroke="none" 
               className={mode !== 'delete' ? "animate-pulse" : ""} 
             />
             <circle cx={router.x} cy={router.y} r={5} fill={mode === 'delete' ? "#ef4444" : "#60a5fa"} />
             <text x={router.x} y={router.y - 10} fill={mode === 'delete' ? "#ef4444" : "#60a5fa"} fontSize="10" textAnchor="middle">{router.id}</text>
          </g>
        ))}

        {/* Nodes */}
        {Array.from(nodes.values()).map((node: Node) => (
          <g
            key={node.id}
            onClick={(e) => {
              e.stopPropagation();
              if (mode === 'delete') onDeleteNode(node.id);
              else onAddEdge(node.id);
            }}
            className="cursor-pointer"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={6}
              fill={getNodeColor(node.id)}
              stroke="#0f172a"
              strokeWidth="2"
            />
            <text
              x={node.x}
              y={node.y + 15}
              fill="#94a3b8"
              fontSize="10"
              textAnchor="middle"
              pointerEvents="none"
            >
              {node.label}
            </text>
          </g>
        ))}

        {/* Trucks */}
        {trucks.map(truck => (
          <g key={truck.id} style={{ transform: `translate(${truck.position.x}px, ${truck.position.y}px)` }} className="transition-transform duration-300 ease-linear pointer-events-none">
            <circle r={8} fill="#f43f5e" stroke="white" strokeWidth="2" />
            <text y={-10} fontSize="8" fill="white" textAnchor="middle">{truck.id}</text>
            <text y={3} fontSize="6" fill="white" textAnchor="middle">{truck.state === 'broken' ? '⚠️' : ''}</text>
          </g>
        ))}

      </svg>
      {mode === 'delete' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-500 text-red-100 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 pointer-events-none">
          <Trash2 className="w-4 h-4" /> Delete Mode Active
        </div>
      )}
    </div>
  );
};