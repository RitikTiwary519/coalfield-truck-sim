import { Node, Edge, Router, Truck, SimulationConfig, SimulationStats } from '../types';
import { distance, findNearestEdge, gaussianRandom, getPointOnSegment } from './geometry';
import { findPath } from './pathfinding';

export class SimulationEngine {
  nodes: Map<string, Node> = new Map();
  edges: Edge[] = [];
  routers: Router[] = [];
  trucks: Truck[] = [];
  
  time: number = 0;
  config: SimulationConfig;
  
  // ID Counters
  nextTruckId: number = 1;

  // Stats
  completedTrips: number = 0;
  totalTripTime: number = 0; // Accumulator for average
  totalTripDistance: number = 0;
  baseTripTimeAccumulator: number = 0; // For delay calculation

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  loadMap(data: { nodes: Node[], edges: Edge[], routers: Router[] }) {
    this.nodes.clear();
    data.nodes.forEach(n => this.nodes.set(n.id, n));
    this.edges = data.edges;
    this.routers = data.routers;
    // Reset state
    this.trucks = [];
    this.time = 0;
    this.completedTrips = 0;
    this.totalTripTime = 0;
    this.totalTripDistance = 0;
    this.nextTruckId = 1;
    
    // Initial router mapping if missing
    this.routers.forEach(r => {
      if (!r.mappedEdgeIds || r.mappedEdgeIds.length === 0) {
        const nearest = findNearestEdge(r, this.edges, this.nodes);
        if (nearest) r.mappedEdgeIds = [nearest];
      }
    });
  }

  // New method to clear trucks and reset stats without deleting the map
  clearSimulation() {
    this.trucks = [];
    this.time = 0;
    this.completedTrips = 0;
    this.totalTripTime = 0;
    this.totalTripDistance = 0;
    this.baseTripTimeAccumulator = 0;
    this.nextTruckId = 1;

    // Reset dynamic edge state
    this.edges.forEach(edge => {
      edge.currentLoad = 0;
      edge.currentWeight = edge.baseTravelTime;
    });
  }

  addNode(node: Node) {
    this.nodes.set(node.id, node);
  }

  removeNode(id: string) {
    this.nodes.delete(id);
    // Remove connected edges
    this.edges = this.edges.filter(e => e.sourceId !== id && e.targetId !== id);
    // Clean up router mappings that might point to deleted edges
    this.routers.forEach(r => {
      r.mappedEdgeIds = r.mappedEdgeIds.filter(eid => this.edges.some(e => e.id === eid));
    });
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  removeEdge(id: string) {
    this.edges = this.edges.filter(e => e.id !== id);
    this.routers.forEach(r => {
      r.mappedEdgeIds = r.mappedEdgeIds.filter(eid => eid !== id);
    });
  }

  addRouter(router: Router) {
    const nearest = findNearestEdge(router, this.edges, this.nodes);
    if (nearest) router.mappedEdgeIds = [nearest];
    else router.mappedEdgeIds = [];
    this.routers.push(router);
  }

  removeRouter(id: string) {
    this.routers = this.routers.filter(r => r.id !== id);
  }

  spawnTruck(startNodeId: string, endNodeId: string) {
    const startNode = this.nodes.get(startNodeId);
    if (!startNode) return;

    // Calculate initial path
    const routeResult = findPath(startNodeId, endNodeId, this.nodes, this.edges);
    if (!routeResult || routeResult.path.length === 0) {
      console.warn("No path found for new truck");
      return;
    }

    const firstEdge = this.edges.find(e => e.id === routeResult.path[0]);
    if(!firstEdge) return;

    const truck: Truck = {
      id: `T-${this.nextTruckId++}`,
      position: { ...startNode },
      currentEdgeId: firstEdge.id,
      distanceAlongEdge: 0,
      speed: Math.random() * (this.config.truckSpeedMax - this.config.truckSpeedMin) + this.config.truckSpeedMin,
      state: 'moving',
      routePlan: routeResult.path, // Full path
      destinationNodeId: endNodeId,
      inferredRouterId: null,
      inferredEdgeId: null,
      lastRouterSwitchTime: 0,
      consecutiveRouterReads: 0,
      potentialRouterId: null,
      totalDistance: 0,
      totalTime: 0,
      rerouteCount: 0
    };

    // Increment load on first edge
    firstEdge.currentLoad++;
    
    this.trucks.push(truck);
  }

  tick() {
    const { dt, alpha, beta, hysteresisN, routerNoiseSigma } = this.config;
    this.time += dt;

    // 1. Move Trucks
    this.trucks.forEach(truck => {
      if (truck.state !== 'moving') return;

      const currentEdge = this.edges.find(e => e.id === truck.currentEdgeId);
      if (!currentEdge) {
        truck.state = 'idle';
        return;
      }

      // Move
      const moveDist = truck.speed * dt;
      truck.distanceAlongEdge += moveDist;
      truck.totalDistance += moveDist;
      truck.totalTime += dt;

      // Update explicit 2D position for visualization
      const startNode = this.nodes.get(currentEdge.sourceId);
      const endNode = this.nodes.get(currentEdge.targetId);
      if (startNode && endNode) {
        const ratio = Math.min(1, truck.distanceAlongEdge / currentEdge.length);
        truck.position = getPointOnSegment(startNode, endNode, ratio);
      }

      // Check for edge completion
      if (truck.distanceAlongEdge >= currentEdge.length) {
        // Exit current edge
        currentEdge.currentLoad = Math.max(0, currentEdge.currentLoad - 1);
        truck.distanceAlongEdge = 0; // Reset for next edge (simplified, ignoring overflow)
        
        // Find next edge in plan
        // The routePlan includes the current edge at index 0? 
        // Let's assume routePlan is [current, next, next...]
        // If we finished current, we shift.
        if (truck.routePlan[0] === truck.currentEdgeId) {
          truck.routePlan.shift();
        }

        if (truck.routePlan.length === 0) {
          truck.state = 'finished';
          truck.currentEdgeId = null;
          this.completedTrips++;
          this.totalTripTime += truck.totalTime;
          // Estimate baseline time (naive)
          this.totalTripDistance += truck.totalDistance; // simple proxy
        } else {
          // Enter next edge
          const nextEdgeId = truck.routePlan[0];
          const nextEdge = this.edges.find(e => e.id === nextEdgeId);
          if (nextEdge && (!nextEdge.isClosed || this.config.policy === 'queue')) {
             truck.currentEdgeId = nextEdge.id;
             nextEdge.currentLoad++;
          } else {
            // Blocked
            truck.state = 'waiting';
            // Simple logic: wait at node until open. 
            // In a real sim, we might reroute immediately here.
          }
        }
      }
    });

    // Clean up finished trucks
    this.trucks = this.trucks.filter(t => t.state !== 'finished');

    // 2. Wi-Fi Localization (Simulated)
    this.trucks.forEach(truck => {
      if (truck.state === 'finished') return;

      // Calculate distance to all routers with noise
      let minD = Infinity;
      let nearestRouterId: string | null = null;

      this.routers.forEach(router => {
        const noise = routerNoiseSigma > 0 ? gaussianRandom(0, routerNoiseSigma) : 0;
        const d = distance(truck.position, router) + noise;
        if (d < minD) {
          minD = d;
          nearestRouterId = router.id;
        }
      });

      // Hysteresis
      if (nearestRouterId) {
        if (nearestRouterId !== truck.inferredRouterId) {
          if (nearestRouterId === truck.potentialRouterId) {
            truck.consecutiveRouterReads++;
          } else {
            truck.potentialRouterId = nearestRouterId;
            truck.consecutiveRouterReads = 1;
          }

          if (truck.consecutiveRouterReads >= hysteresisN) {
            truck.inferredRouterId = nearestRouterId;
            truck.lastRouterSwitchTime = this.time;
            // Update inferred edge
            const router = this.routers.find(r => r.id === nearestRouterId);
            if (router && router.mappedEdgeIds.length > 0) {
              // If multiple, closest projection (omitted for brevity, taking first)
              truck.inferredEdgeId = router.mappedEdgeIds[0];
            }
          }
        } else {
          truck.consecutiveRouterReads = 0;
          truck.potentialRouterId = null;
        }
      }
    });

    // 3. Update Edge Weights (Congestion Model)
    this.edges.forEach(edge => {
      const n = edge.currentLoad;
      const C = edge.capacity;
      // T = T0 * (1 + alpha * (n / C)^beta)
      const congestionFactor = 1 + alpha * Math.pow(n / C, beta);
      edge.currentWeight = edge.baseTravelTime * congestionFactor;
    });

    // 4. Rerouting (Periodic)
    if (this.time % this.config.rerouteInterval < dt) {
      this.trucks.forEach(truck => {
        if (truck.state !== 'moving' || !truck.destinationNodeId || !truck.currentEdgeId) return;

        // Current remaining path cost
        // Simplified: just recalculate from current edge target
        const currentEdge = this.edges.find(e => e.id === truck.currentEdgeId);
        if(!currentEdge) return;

        const result = findPath(currentEdge.targetId, truck.destinationNodeId, this.nodes, this.edges);
        if (result) {
            // Check if new path is significantly better? 
            // Ideally we compare against current plan cost.
            // For now, we just update the plan to be dynamic (Greedy Dynamic Routing)
            // But we must preserve current edge in plan
            truck.routePlan = [truck.currentEdgeId, ...result.path];
            truck.rerouteCount++;
        }
      });
    }
  }

  getStats(): SimulationStats {
    const totalDelay = this.completedTrips > 0 ? (this.totalTripTime - (this.totalTripDistance / ((this.config.truckSpeedMax+this.config.truckSpeedMin)/2))) : 0;
    
    return {
      time: this.time,
      activeTrucks: this.trucks.length,
      completedTrips: this.completedTrips,
      avgTravelTime: this.completedTrips > 0 ? this.totalTripTime / this.completedTrips : 0,
      totalDistance: this.totalTripDistance,
      avgDelay: Math.max(0, totalDelay) // Rough proxy
    };
  }
}