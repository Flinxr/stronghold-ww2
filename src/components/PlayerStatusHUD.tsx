import React from 'react';
import { BuildingInstance, LobbyRoomData } from '../types';
import { PLAYERS_CONFIG } from '../game/constants';
import { Skull } from 'lucide-react';

interface PlayerStatusHUDProps {
  buildings: BuildingInstance[];
  selfPlayerId?: number;
  currentLobby?: LobbyRoomData | null;
}

export const PlayerStatusHUD: React.FC<PlayerStatusHUDProps> = ({
  buildings,
  selfPlayerId = 1,
  currentLobby,
}) => {
  // Only show status for players who actually have a keep in the match
  const activePlayerIds = [1, 2, 3, 4].filter((pId) =>
    buildings.some((b) => b.type === 'keep' && (b.playerId === pId || (!b.playerId && pId === (b.isEnemy ? 2 : 1))))
  );

  const sortedPlayerIds = [...activePlayerIds].sort((a, b) => {
    if (a === selfPlayerId) return -1;
    if (b === selfPlayerId) return 1;
    return a - b;
  });

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {sortedPlayerIds.map((pId) => {
        const cfg = PLAYERS_CONFIG[pId] || PLAYERS_CONFIG[1];
        const keep = buildings.find(
          (b) => b.type === 'keep' && (b.playerId === pId || (!b.playerId && pId === (b.isEnemy ? 2 : 1)))
        );
        const isAlive = keep && keep.hp > 0;
        const pct = keep ? Math.max(0, Math.min(100, Math.round((keep.hp / keep.maxHp) * 100))) : 0;
        const isMe = pId === selfPlayerId;

        let displayName = '';
        if (isMe) {
          displayName = 'شما';
        } else if (currentLobby && currentLobby.players) {
          const lp = currentLobby.players.find((p) => p.playerId === pId);
          displayName = lp ? lp.name : (pId === 2 ? 'قرمز' : pId === 3 ? 'زرد' : 'بنفش');
        } else {
          displayName = pId === 2 ? 'دشمن' : pId === 3 ? 'زرد' : 'بنفش';
        }

        const color = cfg.colorCss;

        return (
          <div
            key={pId}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
              isMe
                ? 'bg-zinc-900/95 border-amber-400/50 text-zinc-100 shadow-sm ring-1 ring-amber-400/20'
                : isAlive
                ? 'bg-zinc-950/70 border-white/10 text-zinc-300'
                : 'bg-red-950/40 border-red-500/30 text-zinc-500 line-through opacity-60'
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
              style={{
                backgroundColor: color,
                boxShadow: isMe ? `0 0 6px ${color}` : undefined,
              }}
            />
            <span className={`truncate max-w-[60px] sm:max-w-[80px] ${isMe ? 'text-amber-200 font-bold' : ''}`}>
              {displayName}
            </span>

            {isAlive ? (
              <div className="w-8 sm:w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/10 shrink-0">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
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
  );
};
