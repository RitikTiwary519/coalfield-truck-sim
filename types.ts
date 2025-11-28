export interface Point {
  x: number;
  y: number;
}

export interface Node extends Point {
  id: string;
  label: string;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  length: number; // meters
  capacity: number; // max trucks
  baseSpeed: number; // m/s
  baseTravelTime: number; // seconds
  currentLoad: number; // current simulated trucks
  currentWeight: number; // dynamic travel time
  isClosed: boolean;
}

export interface Router extends Point {
  id: string;
  mappedEdgeIds: string[]; // Potential edges this router covers
}

export type TruckState = 'moving' | 'waiting' | 'broken' | 'idle' | 'finished';

export interface Truck {
  id: string;
  position: Point;
  currentEdgeId: string | null;
  distanceAlongEdge: number;
  speed: number;
  state: TruckState;
  routePlan: string[]; // List of edge IDs to follow
  destinationNodeId: string | null;
  
  // Simulated WiFi Localization State
  inferredRouterId: string | null;
  inferredEdgeId: string | null;
  lastRouterSwitchTime: number;
  consecutiveRouterReads: number; // For hysteresis
  potentialRouterId: string | null; // For hysteresis
  
  // Metrics
  totalDistance: number;
  totalTime: number;
  rerouteCount: number;
}

export interface SimulationConfig {
  dt: number; // seconds
  hysteresisN: number;
  routerNoiseSigma: number;
  alpha: number; // Congestion sensitivity
  beta: number; // Congestion exponent
  rerouteInterval: number; // seconds
  truckSpeedMin: number;
  truckSpeedMax: number;
  policy: 'queue' | 'closed_when_full';
}

export interface SimulationStats {
  time: number;
  activeTrucks: number;
  completedTrips: number;
  avgTravelTime: number;
  totalDistance: number;
  avgDelay: number;
}

export type EditorMode = 'view' | 'add_node' | 'add_edge' | 'add_router' | 'delete';