import { useRef, useCallback } from "react";

export interface MouseTelemetryData {
  velocity: number;
  jitter: number;
  curvature: number;
}

export const useMouseTracker = () => {
  const points = useRef<{ x: number; y: number; t: number }[]>([]);
  const lastSampleTime = useRef<number>(0);

  const startTracking = useCallback(() => {
    points.current = [];
    lastSampleTime.current = Date.now();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    // Sample mouse coordinates every 40ms to avoid clogging state
    if (now - lastSampleTime.current < 40) return;

    points.current.push({
      x: e.clientX,
      y: e.clientY,
      t: now,
    });
    
    lastSampleTime.current = now;
  }, []);

  const getMouseTelemetry = useCallback((): MouseTelemetryData => {
    const pts = points.current;
    if (pts.length < 3) {
      return { velocity: 120, jitter: 1.5, curvature: 4 }; // Default baseline values
    }

    let totalDistance = 0;
    let totalJitter = 0;
    const velocities: number[] = [];

    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const dt = (pts[i].t - pts[i - 1].t) / 1000; // in seconds

      const dist = Math.sqrt(dx * dx + dy * dy);
      totalDistance += dist;

      if (dt > 0) {
        velocities.push(dist / dt);
      }

      // Compute jitter: directional changes
      if (i > 1) {
        const prevDx = pts[i - 1].x - pts[i - 2].x;
        const prevDy = pts[i - 1].y - pts[i - 2].y;
        
        const prevAngle = Math.atan2(prevDy, prevDx);
        const currAngle = Math.atan2(dy, dx);
        
        totalJitter += Math.abs(currAngle - prevAngle);
      }
    }

    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const straightLineDx = endPt.x - startPt.x;
    const straightLineDy = endPt.y - startPt.y;
    const straightLineDistance = Math.sqrt(straightLineDx * straightLineDx + straightLineDy * straightLineDy) || 1;

    // Curvature: Ratio of actual path distance vs straight line
    const curvature = totalDistance / straightLineDistance;
    
    // Average velocity
    const avgVelocity = velocities.length 
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length 
      : 0;

    // Average jitter
    const avgJitter = pts.length > 2 ? totalJitter / (pts.length - 2) : 0;

    return {
      velocity: Math.round(avgVelocity),
      jitter: Number(avgJitter.toFixed(3)),
      curvature: Number(curvature.toFixed(2)),
    };
  }, []);

  return {
    startTracking,
    handleMouseMove,
    getMouseTelemetry,
  };
};
