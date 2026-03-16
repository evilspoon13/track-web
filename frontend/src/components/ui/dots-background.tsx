import { useEffect, useRef, useCallback } from "react";

interface DotsBackgroundProps {
  dotColor?: string;
  spacing?: number;
  baseOpacity?: number;
  hoverRadius?: number;
}

export default function DotsBackground({
  dotColor = "#64748b",
  spacing = 22,
  baseOpacity = 0.55,
  hoverRadius = 90,
}: DotsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number | null>(null);

  // Parse hex color once
  const r = parseInt(dotColor.slice(1, 3), 16);
  const g = parseInt(dotColor.slice(3, 5), 16);
  const b = parseInt(dotColor.slice(5, 7), 16);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const halfW = W / 2;
    const halfH = H / 2;

    ctx.clearRect(0, 0, W, H);

    for (let x = spacing / 2; x < W; x += spacing) {
      for (let y = spacing / 2; y < H; y += spacing) {
        // Edge fade: 0 at center, 1 at corners
        const nx = (x - halfW) / halfW;
        const ny = (y - halfH) / halfH;
        const edgeFade = Math.min(1, Math.sqrt(nx * nx + ny * ny) * 0.85);

        // Mouse lift: boost opacity + radius near cursor
        const dx = x - mx;
        const dy = y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const lift = dist < hoverRadius ? (1 - dist / hoverRadius) : 0;

        const opacity = edgeFade * baseOpacity;
        if (opacity < 0.015) continue;

        const radius = 1 + lift * 1.8;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(opacity, 1)})`;
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [spacing, baseOpacity, hoverRadius, r, g, b]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
    />
  );
}
