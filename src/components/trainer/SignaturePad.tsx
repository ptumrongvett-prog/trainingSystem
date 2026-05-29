import { useRef, useEffect, useCallback } from 'react';

interface Props {
  canvasId: string;
  width?: number;
  height?: number;
  onSignatureChange?: (data: string) => void;
}

export default function SignaturePad({ canvasId, width = 600, height = 140, onSignatureChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasData = useRef(false);

  const getPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const t = 'touches' in e ? e.touches[0] : e;
    return {
      x: (t.clientX - r.left) * (canvas.width / r.width),
      y: (t.clientY - r.top) * (canvas.height / r.height),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      hasData.current = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = () => {
      drawing.current = false;
      if (hasData.current && onSignatureChange) {
        onSignatureChange(canvas.toDataURL());
      }
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [getPos, onSignatureChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasData.current = false;
    onSignatureChange?.('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        id={canvasId}
        width={width}
        height={height}
        style={{
          width: '100%', height: `${height}px`,
          border: '1.5px dashed var(--border)', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)', touchAction: 'none', cursor: 'crosshair',
        }}
      />
      <button onClick={clear} style={{
        marginTop: 4, fontSize: '0.72rem', color: '#f87171', background: 'none',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        ✕ Clear
      </button>
    </div>
  );
}
