import React from 'react';
import { Resources, BuildingInstance, LobbyRoomData } from '../types';
import { PLAYERS_CONFIG } from '../game/constants';
import { Skull } from 'lucide-react';

export const GoldCoinCircle: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${className}`}
      title="طلا"
    >
      <circle cx="12" cy="12" r="10.5" fill="url(#goldRimGrad)" stroke="#fef08a" strokeWidth="1" />
      <circle cx="12" cy="12" r="8" fill="url(#goldCoreGrad)" stroke="#b45309" strokeWidth="0.8" strokeDasharray="1.5 1" />
      <path
        d="M12 7v10M9.5 9.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5c0 1.66-2 2-2.5 3s.5 2 2.5 2"
        stroke="#78350f"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="goldRimGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#f59e0b" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="goldCoreGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
    </svg>
  );
};

interface TopBarProps {
  resources: Resources;
  buildings?: BuildingInstance[];
  selfPlayerId?: number;
  currentLobby?: LobbyRoomData | null;
  isOnline?: boolean;
  pingMs?: number | null;
}

export const TopBar: React.FC<TopBarProps> = ({
  resources,
  buildings = [],
  selfPlayerId = 1,
  currentLobby,
  isOnline,
  pingMs,
}) => {
  // Helper to extract building's owner playerId
  const getBPlayerId = (b: BuildingInstance): number => {
    return b.playerId || (b.isEnemy ? 2 : 1);
  };

  // Find all active player IDs who have a keep on the map
  const rawActiveIds = [1, 2, 3, 4].filter((pId) =>
    buildings.some((b) => b.type === 'keep' && getBPlayerId(b) === pId)
  );

  // If list is empty (e.g. initial tick), ensure selfPlayerId is at least present
  const activeIds = rawActiveIds.length > 0 ? rawActiveIds : [selfPlayerId];

  // Sort so that the local player (selfPlayerId) is ALWAYS prominently placed first!
  const sortedPlayerIds = [...activeIds].sort((a, b) => {
    if (a === selfPlayerId) return -1;
    if (b === selfPlayerId) return 1;
    return a - b;
  });

  return (
    <div className="fixed top-2.5 max-sm:top-1.5 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-black/90 backdrop-blur-2xl border border-white/15 rounded-2xl sm:rounded-full px-3.5 py-1.5 max-sm:px-2.5 max-sm:py-1 shadow-[0_10px_30px_rgba(0,0,0,0.7)] dir-rtl text-xs select-none max-w-[98vw] overflow-x-auto">
      {/* 1. PLAYERS & KEEP HEALTH STATUS */}
      <div className="flex items-center gap-1.5 max-sm:gap-1 shrink-0">
        {sortedPlayerIds.map((pId) => {
          const cfg = PLAYERS_CONFIG[pId] || PLAYERS_CONFIG[1];
          const keep = buildings.find((b) => b.type === 'keep' && getBPlayerId(b) === pId);
          const isAlive = keep && keep.hp > 0;
          const pct = keep ? Math.max(0, Math.min(100, Math.round((keep.hp / keep.maxHp) * 100))) : 0;
          const isMe = pId === selfPlayerId;

          // Determine accurate label
          let displayName = '';
          if (isMe) {
            displayName = 'شما';
          } else if (currentLobby && currentLobby.players) {
            const lobbyP = currentLobby.players.find((p) => p.playerId === pId);
            displayName = lobbyP ? lobbyP.name : (pId === 2 ? 'قرمز' : pId === 3 ? 'زرد' : 'بنفش');
          } else {
            displayName = pId === 2 ? 'دشمن' : pId === 3 ? 'زرد' : 'بنفش';
          }

          // Use the ACTUAL player team color from PLAYERS_CONFIG
          const playerColor = cfg.colorCss;

          return (
            <div
              key={pId}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                isMe
                  ? 'bg-zinc-900/95 border-amber-400/50 text-zinc-100 shadow-[0_0_10px_rgba(0,0,0,0.5)] ring-1 ring-amber-400/20'
                  : isAlive
                  ? 'bg-zinc-950/70 border-white/10 text-zinc-300'
                  : 'bg-red-950/40 border-red-500/30 text-zinc-500 line-through opacity-60'
              }`}
              title={`${displayName} (${cfg.nameFa}) - سلامت دژ: ${pct}%`}
            >
              {/* Dynamic Player Color Dot matching exact assigned multiplayer slot */}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{
                  backgroundColor: playerColor,
                  boxShadow: isMe ? `0 0 8px ${playerColor}` : undefined,
                }}
              />

              <span className={`truncate max-w-[60px] sm:max-w-[80px] ${isMe ? 'text-amber-200 font-black' : ''}`}>
                {displayName}
              </span>

              {/* Keep Health Bar */}
              {isAlive ? (
                <div className="w-8 sm:w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/10 shrink-0">
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: playerColor,
                    }}
                  />
                </div>
              ) : (
                <Skull className="w-3 h-3 text-red-500 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical divider on desktop */}
      <div className="hidden sm:block w-[1px] h-4 bg-white/20 shrink-0" />

      {/* Realtime Ping / Online Status Indicator */}
      {isOnline && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-950/80 border border-white/10 text-zinc-300 shrink-0 select-none shadow-sm"
          title={`تاخیر همگام‌سازی شبکه: ${pingMs ?? 0}ms`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              pingMs == null
                ? 'bg-zinc-400 animate-pulse'
                : pingMs < 80
                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                : pingMs < 180
                ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                : 'bg-red-400 shadow-[0_0_6px_#f87171]'
            }`}
          />
          <span>
            {pingMs != null ? `${pingMs}ms` : 'آنلاین'}
          </span>
        </div>
      )}

      {/* 2. KINGDOM RESOURCES */}
      <div className="flex items-center gap-3 max-sm:gap-2 font-mono font-bold whitespace-nowrap text-xs max-sm:text-[10px] shrink-0">
        {/* Guaranteed Golden Coin Icon: 100% Gold in all resolutions and phones */}
        <span className="text-amber-300 flex items-center gap-1" title="موجودی طلا">
          <GoldCoinCircle size={16} />
          <span className="text-amber-200 font-bold">{resources.gold}</span>
        </span>

        {/* Wood */}
        <span className="text-emerald-400 flex items-center gap-1" title="چوب">
          <span>🪵</span>
          <span className="text-zinc-100">{resources.wood}</span>
        </span>

        {/* Stone */}
        <span className="text-stone-300 flex items-center gap-1" title="سنگ">
          <span>🪨</span>
          <span className="text-zinc-100">{resources.stone}</span>
        </span>

        {/* Food */}
        <span className="text-orange-400 flex items-center gap-1" title="غذا">
          <span>🌾</span>
          <span className="text-zinc-100">{resources.food}</span>
        </span>

        {/* Population */}
        <span className="text-blue-300 flex items-center gap-1 border-r border-white/15 pr-2 max-sm:pr-1" title="جمعیت">
          <span>👥</span>
          <span className="text-zinc-100">
            {resources.population}/{resources.maxPopulation}
          </span>
        </span>
      </div>
    </div>
  );
};
