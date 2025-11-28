import React, { useState, useEffect, useRef } from 'react';
import { SimulationEngine } from './services/SimulationEngine';
import { SimulationMap } from './components/SimulationMap';
import { distance } from './services/geometry';
import { Node, Edge, Router, Truck, SimulationConfig, SimulationStats, EditorMode } from './types';
import { Play, Pause, RotateCcw, Truck as TruckIcon, Wifi, AlertOctagon, Settings, Navigation, BarChart3, Trash2, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Default Configuration
const DEFAULT_CONFIG: SimulationConfig = {
  dt: 0.5,
  hysteresisN: 3,
  routerNoiseSigma: 10,
  alpha: 1.0,
  beta: 2.0,
  rerouteInterval: 2.0,
  truckSpeedMin: 20, // px/s
  truckSpeedMax: 40,
  policy: 'queue'
};

const DEFAULT_MAP = {
  nodes: [
    { id: 'n1', x: 100, y: 100, label: 'Depot' },
    { id: 'n2', x: 300, y: 100, label: 'Junction A' },
    { id: 'n3', x: 500, y: 200, label: 'Pit 1' },
    { id: 'n4', x: 300, y: 400, label: 'Crusher' },
    { id: 'n5', x: 100, y: 300, label: 'Workshop' }
  ],
  edges: [
    { id: 'e1', sourceId: 'n1', targetId: 'n2', length: 200, capacity: 2, baseSpeed: 30, baseTravelTime: 6.6, currentLoad: 0, currentWeight: 6.6, isClosed: false },
    { id: 'e2', sourceId: 'n2', targetId: 'n3', length: 223, capacity: 1, baseSpeed: 25, baseTravelTime: 8.9, currentLoad: 0, currentWeight: 8.9, isClosed: false },
    { id: 'e3', sourceId: 'n3', targetId: 'n4', length: 282, capacity: 2, baseSpeed: 30, baseTravelTime: 9.4, currentLoad: 0, currentWeight: 9.4, isClosed: false },
    { id: 'e4', sourceId: 'n4', targetId: 'n5', length: 223, capacity: 2, baseSpeed: 35, baseTravelTime: 6.3, currentLoad: 0, currentWeight: 6.3, isClosed: false },
    { id: 'e5', sourceId: 'n5', targetId: 'n1', length: 200, capacity: 3, baseSpeed: 40, baseTravelTime: 5.0, currentLoad: 0, currentWeight: 5.0, isClosed: false },
    { id: 'e6', sourceId: 'n2', targetId: 'n4', length: 300, capacity: 1, baseSpeed: 20, baseTravelTime: 15, currentLoad: 0, currentWeight: 15, isClosed: false }
  ],
  routers: [
    { id: 'r1', x: 200, y: 100, mappedEdgeIds: ['e1'] },
    { id: 'r2', x: 400, y: 150, mappedEdgeIds: ['e2'] },
    { id: 'r3', x: 300, y: 250, mappedEdgeIds: ['e6'] },
    { id: 'r4', x: 400, y: 300, mappedEdgeIds: ['e3'] }
  ]
};

export default function App() {
  // State
  const [activeTab, setActiveTab] = useState<'admin' | 'driver' | 'stats'>('admin');
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [engine] = useState(() => new SimulationEngine(DEFAULT_CONFIG));
  
  // Simulation State Sync
  const [nodes, setNodes] = useState<Map<string, Node>>(new Map());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [stats, setStats] = useState<SimulationStats>({
    time: 0, activeTrucks: 0, completedTrips: 0, avgTravelTime: 0, totalDistance: 0, avgDelay: 0
  });
  const [statsHistory, setStatsHistory] = useState<any[]>([]);

  // Editor State
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Driver View State
  const [driverStart, setDriverStart] = useState('');
  const [driverEnd, setDriverEnd] = useState('');
  const [driverMessage, setDriverMessage] = useState<string | null>(null);

  // Init
  useEffect(() => {
    // @ts-ignore
    engine.loadMap(DEFAULT_MAP);
    syncState();
  }, [engine]);

  // Loop
  useEffect(() => {
    let interval: number;
    if (isRunning) {
      interval = window.setInterval(() => {
        engine.tick();
        syncState();
      }, config.dt * 1000); // Scale time 1:1 for simplicity, or faster
    }
    return () => clearInterval(interval);
  }, [isRunning, engine, config.dt]);

  const syncState = () => {
    setNodes(new Map(engine.nodes));
    setEdges([...engine.edges]);
    setRouters([...engine.routers]);
    setTrucks([...engine.trucks]);
    const currentStats = engine.getStats();
    setStats(currentStats);
    setStatsHistory(prev => {
      const nw = [...prev, { time: currentStats.time.toFixed(1), ...currentStats }];
      if (nw.length > 50) nw.shift();
      return nw;
    });
  };

  // Handlers
  const handleToggleSim = () => setIsRunning(!isRunning);
  
  const handleReset = () => {
    setIsRunning(false);
    // @ts-ignore
    engine.loadMap(DEFAULT_MAP);
    syncState();
    setStatsHistory([]);
  };

  const handleMasterRefresh = () => {
    setIsRunning(false);
    engine.clearSimulation();
    syncState();
    setStatsHistory([]);
  };

  const handleAddNode = (x: number, y: number) => {
    const id = `n${Date.now()}`;
    engine.addNode({ id, x, y, label: `Node ${engine.nodes.size + 1}` });
    syncState();
  };
  
  const handleDeleteNode = (id: string) => {
    engine.removeNode(id);
    syncState();
  };

  const handleAddEdge = (nodeId: string) => {
    if (selectedNodeId === null) {
      setSelectedNodeId(nodeId);
    } else {
      if (selectedNodeId !== nodeId) {
        const start = engine.nodes.get(selectedNodeId);
        const end = engine.nodes.get(nodeId);
        if (start && end) {
          const len = distance(start, end);
          const baseSpeed = 30;
          engine.addEdge({
            id: `e-${start.id}-${end.id}`,
            sourceId: start.id,
            targetId: end.id,
            length: len,
            capacity: 2,
            baseSpeed,
            baseTravelTime: len / baseSpeed,
            currentLoad: 0,
            currentWeight: len / baseSpeed,
            isClosed: false
          });
          syncState();
        }
      }
      setSelectedNodeId(null);
    }
  };
  
  const handleDeleteEdge = (id: string) => {
    engine.removeEdge(id);
    syncState();
  };

  const handleAddRouter = (x: number, y: number) => {
    // Generate simple ID R-1, R-2
    // Look at existing routers to find max index
    const maxIndex = routers.reduce((max, r) => {
      // Handle both R-1 and r1 formats
      const match = r.id.match(/^[rR]-?(\d+)$/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    const nextId = `R-${maxIndex + 1}`;

    engine.addRouter({ id: nextId, x, y, mappedEdgeIds: [] });
    syncState();
  };
  
  const handleDeleteRouter = (id: string) => {
    engine.removeRouter(id);
    syncState();
  };

  const handleSpawnTruck = () => {
    const nodeIds = Array.from(engine.nodes.keys());
    if (nodeIds.length < 2) return;
    const start = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    let end = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    while (end === start) end = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    engine.spawnTruck(start, end);
    syncState();
  };

  const handleRequestRoute = () => {
    if (!driverStart || !driverEnd || driverStart === driverEnd) return;
    engine.spawnTruck(driverStart, driverEnd);
    setDriverMessage(`Trip requested: ${engine.nodes.get(driverStart)?.label} to ${engine.nodes.get(driverEnd)?.label}`);
    setTimeout(() => setDriverMessage(null), 3000);
    syncState();
  };

  const handleToggleClosure = (edgeId: string) => {
    const edge = engine.edges.find(e => e.id === edgeId);
    if (edge) {
      edge.isClosed = !edge.isClosed;
      syncState();
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
            <TruckIcon className="w-6 h-6" /> CoalTruck Sim
          </h1>
          <p className="text-xs text-slate-500 mt-1">Simulation Only Environment</p>
        </div>

        {/* Navigation */}
        <div className="flex p-2 gap-1 bg-slate-900">
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-2 text-sm rounded ${activeTab === 'admin' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Admin
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`flex-1 py-2 text-sm rounded ${activeTab === 'driver' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Driver
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 text-sm rounded ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Stats
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Admin Panel */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-300">
                  <Settings className="w-4 h-4" /> Simulation Controls
                </h3>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleToggleSim}
                    className={`flex-1 py-2 rounded flex items-center justify-center gap-2 font-medium ${isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {isRunning ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Run</>}
                  </button>
                  <button onClick={handleReset} className="px-3 bg-slate-700 rounded hover:bg-slate-600" title="Reset to Default Map">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleMasterRefresh} 
                    className="px-3 bg-red-700 rounded hover:bg-red-800 text-white" 
                    title="Master Refresh: Clear Trucks & Reset Sim"
                  >
                     <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-3 text-sm">
                   <label className="flex flex-col gap-1">
                     <span className="text-slate-400">Timestep (dt): {config.dt}s</span>
                     <input type="range" min="0.1" max="2.0" step="0.1" value={config.dt} onChange={e => setConfig({...config, dt: parseFloat(e.target.value)})} className="accent-blue-500" />
                   </label>
                   <label className="flex flex-col gap-1">
                     <span className="text-slate-400">Congestion Sensitivity (α): {config.alpha}</span>
                     <input type="range" min="0" max="5" step="0.1" value={config.alpha} onChange={e => setConfig({...config, alpha: parseFloat(e.target.value)})} className="accent-blue-500" />
                   </label>
                   <label className="flex flex-col gap-1">
                     <span className="text-slate-400">Wifi Noise (σ): {config.routerNoiseSigma}px</span>
                     <input type="range" min="0" max="50" step="1" value={config.routerNoiseSigma} onChange={e => setConfig({...config, routerNoiseSigma: parseFloat(e.target.value)})} className="accent-blue-500" />
                   </label>
                   <label className="flex items-center justify-between text-slate-400">
                     <span>Reroute Interval</span>
                     <select 
                       value={config.rerouteInterval} 
                       onChange={e => setConfig({...config, rerouteInterval: parseFloat(e.target.value)})}
                       className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
                     >
                       <option value={1}>1s</option>
                       <option value={2}>2s</option>
                       <option value={5}>5s</option>
                       <option value={10}>10s</option>
                     </select>
                   </label>
                </div>
              </div>

              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold mb-3 text-slate-300">Map Editor</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['view', 'add_node', 'add_edge', 'add_router', 'delete'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setEditorMode(m); setSelectedNodeId(null); }}
                      className={`px-2 py-2 text-xs rounded capitalize border flex items-center justify-center gap-1 ${editorMode === m 
                        ? (m === 'delete' ? 'bg-red-600 border-red-500 text-white' : 'bg-blue-600 border-blue-500 text-white')
                        : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
                    >
                      {m === 'delete' && <Trash2 className="w-3 h-3" />}
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {editorMode === 'add_edge' ? 'Click Start Node then End Node.' : 
                   editorMode === 'add_node' ? 'Click map to place Node.' : 
                   editorMode === 'add_router' ? 'Click map to place Beacon.' : 
                   editorMode === 'delete' ? 'Click any item to delete it.' :
                   'Click edge to toggle close.'}
                </p>
              </div>

              <button onClick={handleSpawnTruck} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold flex items-center justify-center gap-2">
                <TruckIcon className="w-4 h-4" /> Spawn Random Truck
              </button>
            </div>
          )}

          {/* Driver Panel */}
          {activeTab === 'driver' && (
            <div className="space-y-6">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-green-400" /> Route Request
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Current Location</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={driverStart} onChange={e => setDriverStart(e.target.value)}>
                      <option value="">Select Start</option>
                      {Array.from(nodes.values()).map((n: Node) => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Destination</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={driverEnd} onChange={e => setDriverEnd(e.target.value)}>
                      <option value="">Select Destination</option>
                      {Array.from(nodes.values()).map((n: Node) => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                  </div>
                  <button onClick={handleRequestRoute} className="w-full py-2 bg-green-600 hover:bg-green-700 rounded font-medium">
                    Start Trip
                  </button>
                  {driverMessage && (
                    <div className="p-2 bg-green-900/30 text-green-400 text-xs rounded border border-green-800">
                      {driverMessage}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Fleet Status</h4>
                {trucks.length === 0 && <p className="text-sm text-slate-600 italic">No trucks active.</p>}
                {trucks.map(truck => {
                  const currNode = nodes.get(edges.find(e => e.id === truck.currentEdgeId)?.targetId || '');
                  return (
                    <div key={truck.id} className="bg-slate-800 p-3 rounded border-l-4 border-indigo-500 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-200">{truck.id}</span>
                        <span className={`px-1.5 rounded ${truck.state === 'moving' ? 'bg-green-900 text-green-300' : 'bg-amber-900 text-amber-300'}`}>
                          {truck.state}
                        </span>
                      </div>
                      <div className="text-slate-400">Heading to: {currNode?.label || 'Unknown'}</div>
                      <div className="text-slate-500 mt-1 flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> 
                        Signal: {truck.inferredRouterId ? `Router ${truck.inferredRouterId}` : 'Searching...'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Panel */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-2">
                 <div className="bg-slate-800 p-3 rounded">
                   <div className="text-xs text-slate-400">Completed</div>
                   <div className="text-2xl font-bold">{stats.completedTrips}</div>
                 </div>
                 <div className="bg-slate-800 p-3 rounded">
                   <div className="text-xs text-slate-400">Avg Time</div>
                   <div className="text-2xl font-bold">{stats.avgTravelTime.toFixed(1)}s</div>
                 </div>
                 <div className="bg-slate-800 p-3 rounded">
                   <div className="text-xs text-slate-400">Avg Delay</div>
                   <div className="text-2xl font-bold text-amber-500">{stats.avgDelay.toFixed(1)}s</div>
                 </div>
                 <div className="bg-slate-800 p-3 rounded">
                   <div className="text-xs text-slate-400">Active</div>
                   <div className="text-2xl font-bold text-blue-400">{stats.activeTrucks}</div>
                 </div>
               </div>
               
               <div className="bg-slate-800 p-2 rounded h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                      <Area type="monotone" dataKey="activeTrucks" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
               <div className="bg-slate-800 p-2 rounded h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={statsHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                      <Line type="monotone" dataKey="avgDelay" stroke="#f59e0b" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative">
        <SimulationMap 
          nodes={nodes}
          edges={edges}
          routers={routers}
          trucks={trucks}
          mode={editorMode}
          onAddNode={handleAddNode}
          onAddEdge={handleAddEdge}
          onAddRouter={handleAddRouter}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onDeleteRouter={handleDeleteRouter}
          onToggleClosure={handleToggleClosure}
          selectedNodeId={selectedNodeId}
        />
        
        {/* Map Overlay Stats */}
        <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded text-xs text-slate-400 pointer-events-none">
          <div>Sim Time: {stats.time.toFixed(1)}s</div>
          <div>Trucks: {trucks.length}</div>
        </div>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded text-xs space-y-2 pointer-events-none">
           <div className="font-semibold text-slate-300 mb-1">Map Legend</div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400"></div> Node</div>
           <div className="flex items-center gap-2"><div className="w-6 h-1 bg-green-500"></div> Free Flow</div>
           <div className="flex items-center gap-2"><div className="w-6 h-1 bg-red-600"></div> Congested</div>
           <div className="flex items-center gap-2"><Wifi className="w-3 h-3 text-blue-400" /> Router Beacon</div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div> Truck</div>
        </div>
      </div>
    </div>
  );
}