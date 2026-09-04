import React from 'react';
import { BuildingType, Resources } from '../types';
import { BUILDINGS_CONFIG } from '../game/constants';
import { soundManager } from '../game/audio';
import {
  Home,
  Wheat,
  Pickaxe,
  Trees,
  Coins,
  Swords,
  TowerControl,
  Shield,
  X,
  Hammer,
} from 'lucide-react';

interface BuildMenuProps {
  resources: Resources;
  activeBuildType: BuildingType | null;
  setActiveBuildType: (type: BuildingType | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="w-5 h-5 text-amber-400" />,
  Wheat: <Wheat className="w-5 h-5 text-orange-400" />,
  Pickaxe: <Pickaxe className="w-5 h-5 text-slate-300" />,
  Trees: <Trees className="w-5 h-5 text-emerald-400" />,
  Coins: <Coins className="w-5 h-5 text-yellow-400" />,
  Swords: <Swords className="w-5 h-5 text-red-400" />,
  TowerControl: <TowerControl className="w-5 h-5 text-indigo-400" />,
  Shield: <Shield className="w-5 h-5 text-blue-400" />,
};

export const BuildMenu: React.FC<BuildMenuProps> = ({
  resources,
  activeBuildType,
  setActiveBuildType,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const buildingKeys: BuildingType[] = [
    'house',
    'farm',
    'woodcutter',
    'quarry',
    'market',
    'barracks',
    'tower',
    'wall',
  ];

  const canAfford = (type: BuildingType) => {
    const cost = BUILDINGS_CONFIG[type].cost;
    return (
      resources.gold >= cost.gold &&
      resources.wood >= cost.wood &&
      resources.stone >= cost.stone
    );
  };

  const handleSelectBuilding = (type: BuildingType) => {
    if (activeBuildType === type) {
      setActiveBuildType(null);
    } else if (canAfford(type)) {
      soundManager.playClick();
      setActiveBuildType(type);
    }
  };

  return (
    <aside className="fixed top-16 left-4 z-40 w-72 md:w-80 max-h-[calc(100vh-14rem)] overflow-y-auto bg-black/85 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-3.5 text-zinc-100 dir-rtl font-sans transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Hammer className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">ساخت و ساز قلعه</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeBuildType && (
        <div className="mb-3 p-2.5 bg-blue-500/10 border border-blue-500/40 rounded-2xl flex items-center justify-between text-xs">
          <span className="text-blue-200 font-bold">
            حالت ساخت: {BUILDINGS_CONFIG[activeBuildType].nameFa}
          </span>
          <button
            onClick={() => setActiveBuildType(null)}
            className="text-red-400 hover:text-red-300 font-bold px-2.5 py-1 rounded-full bg-black/50 border border-red-500/30 transition text-[11px]"
          >
            لغو ساخت
          </button>
        </div>
      )}

      {/* Building Cards */}
      <div className="space-y-2">
        {buildingKeys.map((key) => {
          const b = BUILDINGS_CONFIG[key];
          const affordable = canAfford(key);
          const isSelected = activeBuildType === key;

          return (
            <div
              key={key}
              onClick={() => handleSelectBuilding(key)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50'
                  : affordable
                  ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                  : 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-black/60 border border-white/10 shadow-inner">
                    {ICON_MAP[b.icon]}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-zinc-100">{b.nameFa}</h3>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">{b.descriptionFa}</p>
                  </div>
                </div>
              </div>

              {/* Resource Cost Badges */}
              <div className="flex items-center gap-1.5 text-[10px] mt-2 pt-2 border-t border-white/5 font-mono">
                {b.cost.gold > 0 && (
                  <span className={`px-2 py-0.5 rounded-full ${resources.gold >= b.cost.gold ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30 font-bold'}`}>
                    🪙 {b.cost.gold}
                  </span>
                )}
                {b.cost.wood > 0 && (
                  <span className={`px-2 py-0.5 rounded-full ${resources.wood >= b.cost.wood ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30 font-bold'}`}>
                    🪵 {b.cost.wood}
                  </span>
                )}
                {b.cost.stone > 0 && (
                  <span className={`px-2 py-0.5 rounded-full ${resources.stone >= b.cost.stone ? 'bg-zinc-500/20 text-zinc-200 border border-zinc-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30 font-bold'}`}>
                    🪨 {b.cost.stone}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
