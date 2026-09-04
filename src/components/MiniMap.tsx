import React, { useEffect, useRef } from 'react';
import { BuildingInstance, UnitInstance } from '../types';
import { MAP_SIZE } from '../game/constants';
import { Compass } from 'lucide-react';

interface MiniMapProps {
  buildings: BuildingInstance[];
  units: UnitInstance[];
  cameraPos: { x: number; z: number };
  onMapClick: (x: number, z: number) => void;
}

const TEAM_COLORS: Record<number, string> = {
  1: '#2563eb', // Player 1 (Blue)
  2: '#ef4444', // Player 2 (Red)
  3: '#f59e0b', // Player 3 (Yellow)
  4: '#a855f7', // Player 4 (Purple)
};

export const MiniMap: React.FC<MiniMapProps> = ({
  buildings,
  units,
  cameraPos,
  onMapClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scale = w / MAP_SIZE;

    // Background terrain map
    ctx.fillStyle = '#22381f';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#324a2f';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < MAP_SIZE; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * scale);
      ctx.lineTo(w, i * scale);
      ctx.stroke();
    }

    // Render Buildings
    buildings.forEach((b) => {
      const pid = b.playerId || (b.isEnemy ? 2 : 1);
      ctx.fillStyle = TEAM_COLORS[pid] || '#2563eb';
      const size = b.type === 'keep' ? 3.5 : b.type === 'wall' ? 1 : 2;
      ctx.fillRect(b.gridX * scale, b.gridZ * scale, size * scale, size * scale);
    });

    // Render Units
    units.forEach((u) => {
      const pid = u.playerId || (u.isEnemy ? 2 : 1);
      ctx.fillStyle = TEAM_COLORS[pid] || '#2563eb';
      ctx.beginPath();
      ctx.arc(u.x * scale, u.z * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Camera view box
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    const boxSize = 12 * scale;
    ctx.strokeRect(
      cameraPos.x * scale - boxSize / 2,
      cameraPos.z * scale - boxSize / 2,
      boxSize,
      boxSize
    );
  }, [buildings, units, cameraPos]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scale = canvas.width / MAP_SIZE;
    const mapX = Math.max(0, Math.min(MAP_SIZE, clickX / scale));
    const mapZ = Math.max(0, Math.min(MAP_SIZE, clickY / scale));

    onMapClick(mapX, mapZ);
  };

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 shadow-lg overflow-hidden relative dir-rtl">
      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5 px-1">
        <span className="flex items-center gap-1.5 text-zinc-200">
          <Compass className="w-3.5 h-3.5 text-blue-400" />
          نقشه تاکتیکی رادار
        </span>
        <span className="text-[9px] text-blue-400 font-mono">SECTOR 04</span>
      </div>
      <canvas
        ref={canvasRef}
        width={240}
        height={240}
        onClick={handleCanvasClick}
        className="w-full h-auto rounded-lg border border-zinc-800 cursor-crosshair shadow-inner bg-[#1e2916]"
      />
    </div>
  );
};
