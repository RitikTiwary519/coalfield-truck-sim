import { Edge, Node } from '../types';
import { distance } from './geometry';

// A* Algorithm
export const findPath = (
  startNodeId: string,
  endNodeId: string,
  nodes: Map<string, Node>,
  edges: Edge[]
): { path: string[], eta: number } | null => {
  
  const openSet = new Set<string>([startNodeId]);
  const cameFrom = new Map<string, { edgeId: string, nodeId: string }>();
  
  const gScore = new Map<string, number>();
  gScore.set(startNodeId, 0);
  
  const fScore = new Map<string, number>();
  const startNode = nodes.get(startNodeId);
  const endNode = nodes.get(endNodeId);
  
  if (!startNode || !endNode) return null;

  fScore.set(startNodeId, distance(startNode, endNode));

  while (openSet.size > 0) {
    // Get node in openSet with lowest fScore
    let current = '';
    let minF = Infinity;
    
    for (const nodeId of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < minF) {
        minF = f;
        current = nodeId;
      }
    }

    if (current === endNodeId) {
      return reconstructPath(cameFrom, current, edges);
    }

    openSet.delete(current);

    // Find neighbors
    const neighbors = edges.filter(e => e.sourceId === current && !e.isClosed);
    
    for (const edge of neighbors) {
      const neighbor = edge.targetId;
      // Weight is the DYNAMIC travel time of the edge
      const tentativeGScore = (gScore.get(current) ?? Infinity) + edge.currentWeight;

      if (tentativeGScore < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, { edgeId: edge.id, nodeId: current });
        gScore.set(neighbor, tentativeGScore);
        
        const neighborNode = nodes.get(neighbor);
        const heuristic = neighborNode ? distance(neighborNode, endNode) / edge.baseSpeed : 0; // Time heuristic
        
        fScore.set(neighbor, tentativeGScore + heuristic);
        openSet.add(neighbor);
      }
    }
  }

  return null; // No path found
};

const reconstructPath = (
  cameFrom: Map<string, { edgeId: string, nodeId: string }>,
  current: string,
  edges: Edge[]
): { path: string[], eta: number } => {
  const totalPath: string[] = [];
  let totalTime = 0;
  let curr = current;

  while (cameFrom.has(curr)) {
    const prev = cameFrom.get(curr)!;
    totalPath.unshift(prev.edgeId);
    const edge = edges.find(e => e.id === prev.edgeId);
    if (edge) totalTime += edge.currentWeight;
    curr = prev.nodeId;
  }

  return { path: totalPath, eta: totalTime };
};
