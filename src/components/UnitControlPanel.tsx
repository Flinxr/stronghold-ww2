import React from 'react';
import { UnitType, Resources, UnitInstance, BuildingInstance } from '../types';
import { UNITS_CONFIG } from '../game/constants';
import { soundManager } from '../game/audio';
import {
  Swords,
  Shield,
  Target,
  Crown,
  Users,
  Crosshair,
  Square,
  Sparkles,
  Milestone,
} from 'lucide-react';

interface UnitControlPanelProps {
  selectedUnits: UnitInstance[];
  selectedBuilding: BuildingInstance | null;
  resources: Resources;
  onTrainUnit: (type: UnitType) => void;
  onSelectAllUnits: () => void;
}

export const UnitControlPanel: React.FC<UnitControlPanelProps> = ({
  selectedUnits,
  selectedBuilding,
  resources,
  onTrainUnit,
  onSelectAllUnits,
}) => {
  const recruitTypes: UnitType[] = ['swordsman', 'spearman', 'archer', 'knight'];

  const canAffordUnit = (type: UnitType) => {
    const cost = UNITS_CONFIG[type].cost;
    const popNeeded = 1;
    return (
      resources.gold >= cost.gold &&
      resources.wood >= cost.wood &&
      resources.stone >= cost.stone &&
      resources.food >= (cost.food || 0) &&
      resources.population + popNeeded <= resources.maxPopulation
    );
  };

  const isBarracksSelected = selectedBuilding && selectedBuilding.type === 'barracks';

  if (!isBarracksSelected && selectedUnits.length === 0) {
    return (
      <div className="fixed bottom-4 left-4 z-30 max-w-[calc(100vw-12rem)] bg-black/85 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-2 text-xs text-zinc-300 dir-rtl flex items-center gap-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-zinc-300 line-clamp-1">برای جذب نیرو روی سربازخانه کلیک کنید یا با درگ موش سربازان را انتخاب نمایید.</span>
        </div>
        <button
          onClick={() => {
            soundManager.playClick();
            onSelectAllUnits();
          }}
          className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-200 px-3 py-1 rounded-full transition font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(59,130,246,0.2)] shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          انتخاب نیروها (S)
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-30 w-72 md:w-80 max-h-[12rem] overflow-y-auto bg-black/85 backdrop-blur-xl border border-white/20 rounded-3xl p-3.5 shadow-2xl text-zinc-100 dir-rtl font-sans">
      {/* If Barracks Selected: Recruitment */}
      {isBarracksSelected && (
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300">
                <Swords className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-blue-400">
                آموزش نیروها
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              {resources.population}/{resources.maxPopulation}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {recruitTypes.map((type) => {
              const u = UNITS_CONFIG[type];
              const affordable = canAffordUnit(type);

              return (
                <button
                  key={type}
                  onClick={() => {
                    if (affordable) {
                      soundManager.playRecruitSound();
                      onTrainUnit(type);
                    }
                  }}
                  disabled={!affordable}
                  className={`p-2.5 rounded-2xl border text-right transition flex flex-col justify-between ${
                    affordable
                      ? 'bg-white/5 border-white/10 hover:border-blue-500/60 hover:bg-blue-600/10'
                      : 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-200">{u.nameFa}</span>
                    {type === 'archer' && <Target className="w-3.5 h-3.5 text-teal-400" />}
                    {type === 'swordsman' && <Swords className="w-3.5 h-3.5 text-blue-400" />}
                    {type === 'spearman' && <Milestone className="w-3.5 h-3.5 text-sky-400" />}
                    {type === 'knight' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between font-mono dir-ltr">
                    <span className="text-emerald-400" title="آسیب به نیروها">⚔️{u.damageToUnits}</span>
                    <span className="text-amber-400" title="آسیب به سازه‌ها">🏚️{u.damageToBuildings}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 flex flex-wrap gap-1 font-mono">
                    <span>🪙{u.cost.gold}</span>
                    {u.cost.wood > 0 && <span>🪵{u.cost.wood}</span>}
                    {u.cost.stone > 0 && <span>🪨{u.cost.stone}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Units Summary */}
      {selectedUnits.length > 0 && (
        <div className={isBarracksSelected ? 'mt-4 pt-4 border-t border-white/10' : ''}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-400" />
                سربازان منتخب
              </h3>
              <p className="text-[10px] text-zinc-500 italic">{selectedUnits.length} واحد رزمی آماده دستور</p>
            </div>
            <button
              onClick={onSelectAllUnits}
              className="px-2.5 py-1 bg-blue-900/40 border border-blue-500/30 rounded-lg text-[10px] font-mono text-blue-200 hover:bg-blue-800/50 transition"
            >
              انتخاب همه (S)
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-300">
              <span>سلامت گروه</span>
              <span className="font-mono text-zinc-300">
                {selectedUnits.reduce((acc, u) => acc + Math.max(0, u.hp), 0)} HP
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
