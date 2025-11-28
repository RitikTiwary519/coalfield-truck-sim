import { Point, Node, Edge } from '../types';

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getPointOnSegment = (p1: Point, p2: Point, ratio: number): Point => {
  return {
    x: p1.x + (p2.x - p1.x) * ratio,
    y: p1.y + (p2.y - p1.y) * ratio,
  };
};

export const distanceToSegment = (p: Point, v: Point, w: Point): number => {
  const l2 = Math.pow(distance(v, w), 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  };
  return distance(p, projection);
};

export const findNearestEdge = (p: Point, edges: Edge[], nodes: Map<string, Node>): string | null => {
  let minDist = Infinity;
  let nearestId = null;

  edges.forEach(edge => {
    const start = nodes.get(edge.sourceId);
    const end = nodes.get(edge.targetId);
    if (start && end) {
      const d = distanceToSegment(p, start, end);
      if (d < minDist) {
        minDist = d;
        nearestId = edge.id;
      }
    }
  });

  return nearestId;
};

// Box-Muller transform for Gaussian noise
export const gaussianRandom = (mean: number, stdev: number): number => {
  const u = 1 - Math.random(); 
  const v = Math.random();
  const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return z * stdev + mean;
};
