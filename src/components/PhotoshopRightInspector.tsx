import React from 'react';
import { BuildingInstance, UnitInstance, Resources, UnitType, BuildingType } from '../types';
import { BUILDINGS_CONFIG, UNITS_CONFIG } from '../game/constants';
import { soundManager } from '../game/audio';
import { GoldCoinCircle } from './TopBar';
import {
  X,
  Building,
  Swords,
  Coins,
  ArrowDownUp,
  Shield,
  Heart,
  Wrench,
  Users,
  Target,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wheat,
  Pickaxe,
  Trees,
  Crown,
  Milestone,
  TowerControl,
} from 'lucide-react';

interface PhotoshopRightInspectorProps {
  selectedBuilding: BuildingInstance | null;
  selectedUnits: UnitInstance[];
  buildings: BuildingInstance[];
  resources: Resources;
  isOpen: boolean;
  onToggleOpen: () => void;
  onTrainUnit: (type: UnitType) => void;
  onTradeResource: (action: 'buy' | 'sell', resource: 'wood' | 'stone' | 'food', amount?: number) => void;
  onRepairBuilding: (buildingId: string) => void;
  onSelectAllUnits: () => void;
}

export const PhotoshopRightInspector: React.FC<PhotoshopRightInspectorProps> = ({
  selectedBuilding,
  selectedUnits,
  buildings,
  resources,
  isOpen,
  onToggleOpen,
  onTrainUnit,
  onTradeResource,
  onRepairBuilding,
  onSelectAllUnits,
}) => {
  const recruitTypes: UnitType[] = ['swordsman', 'spearman', 'archer', 'knight', 'tank', 'artillery_tank'];

  const canAffordUnit = (type: UnitType) => {
    const cost = UNITS_CONFIG[type].cost;
    return (
      resources.gold >= cost.gold &&
      resources.wood >= cost.wood &&
      resources.stone >= cost.stone &&
      resources.food >= (cost.food || 0) &&
      resources.population + 1 <= resources.maxPopulation
    );
  };

  const activeBuilding = selectedBuilding
    ? buildings.find((b) => b.id === selectedBuilding.id) || selectedBuilding
    : null;

  const bConfig = activeBuilding ? BUILDINGS_CONFIG[activeBuilding.type] : null;

  return (
    <aside
      className={`fixed top-3 right-3 z-40 transition-all duration-300 font-sans dir-rtl select-none ${
        isOpen ? 'w-80 md:w-88' : 'w-12'
      }`}
    >
      <div className="bg-zinc-950/90 backdrop-blur-2xl border border-zinc-800/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-zinc-100 flex flex-col max-h-[calc(100vh-1.5rem)]">
        {/* Photoshop Inspector Title Bar */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-3.5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleOpen}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
              title={isOpen ? 'بستن پنل جزییات' : 'باز کردن پنل جزییات'}
            >
              {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            {isOpen && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-200">
                  {selectedBuilding
                    ? `تنظیمات ${bConfig?.nameFa}`
                    : selectedUnits.length > 0
                    ? `مدیریت ${selectedUnits.length} سرباز`
                    : 'پنل جزییات و صرافی'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Collapsed Strip View */}
        {!isOpen && (
          <div className="p-2 flex flex-col items-center gap-3 py-4 text-zinc-400">
            <button onClick={onToggleOpen} className="hover:text-amber-400 p-1">
              <Building className="w-5 h-5" />
            </button>
            <button onClick={onToggleOpen} className="hover:text-emerald-400 p-1">
              <Coins className="w-5 h-5" />
            </button>
            <button onClick={onToggleOpen} className="hover:text-blue-400 p-1">
              <Swords className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Expanded Panel Body */}
        {isOpen && (
          <div className="p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin scrollbar-thumb-zinc-800">
            {/* 1. MARKET / RESOURCE EXCHANGE MODE */}
            {activeBuilding?.type === 'market' && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="font-bold text-amber-200 text-xs">صرافی و بازار خاورمیانه</h4>
                      <p className="text-[10px] text-amber-400/80">خرید و فروش فوری منابع با طلا</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-amber-300 flex items-center gap-1.5">
                    <GoldCoinCircle size={18} /> {resources.gold}
                  </span>
                </div>

                {/* Trade Resource Rows */}
                {[
                  { id: 'wood' as const, name: 'چوب', icon: '🪵', avail: resources.wood },
                  { id: 'stone' as const, name: 'سنگ', icon: '🪨', avail: resources.stone },
                  { id: 'food' as const, name: 'غذا', icon: '🌾', avail: resources.food },
                ].map((res) => (
                  <div key={res.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className="text-base">{res.icon}</span> {res.name}
                      </span>
                      <span className="font-mono text-zinc-400">موجودی: {res.avail}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onTradeResource('sell', res.id, 50)}
                        disabled={res.avail < 50}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition flex items-center justify-between ${
                          res.avail >= 50
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                            : 'bg-zinc-800/40 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        }`}
                      >
                        <span>فروش ۵۰ عدد</span>
                        <span className="font-mono text-amber-300">+۳۷ 🪙</span>
                      </button>

                      <button
                        onClick={() => onTradeResource('buy', res.id, 50)}
                        disabled={resources.gold < 60}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition flex items-center justify-between ${
                          resources.gold >= 60
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/30'
                            : 'bg-zinc-800/40 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        }`}
                      >
                        <span>خرید ۵۰ عدد</span>
                        <span className="font-mono text-amber-300">-۶۰ 🪙</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. BARRACKS TRAINING MODE */}
            {activeBuilding?.type === 'barracks' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-blue-400" />
                    <div>
                      <h4 className="font-bold text-blue-200 text-xs">پادگان و مرکز آموزش نظامی</h4>
                      <p className="text-[10px] text-blue-400/80">آموزش پیاده‌نظام اتوماتیک، اسنایپر، دوش‌پرتاب و تانک‌ها</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-blue-300 bg-blue-950/80 px-2.5 py-1 rounded-full border border-blue-500/30">
                    👥 {resources.population} / {resources.maxPopulation}
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
                        className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between ${
                          affordable
                            ? 'bg-zinc-900/80 border-zinc-700/80 hover:border-blue-500 hover:bg-blue-600/10'
                            : 'bg-zinc-900/30 border-zinc-800/40 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-zinc-200">{u.nameFa}</span>
                          {type === 'archer' && <Target className="w-3.5 h-3.5 text-emerald-400" />}
                          {type === 'swordsman' && <Swords className="w-3.5 h-3.5 text-blue-400" />}
                          {type === 'spearman' && <Milestone className="w-3.5 h-3.5 text-sky-400" />}
                          {type === 'knight' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          {type === 'tank' && <Shield className="w-3.5 h-3.5 text-zinc-300" />}
                          {type === 'artillery_tank' && <Target className="w-3.5 h-3.5 text-orange-400" />}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="flex items-center gap-0.5 text-amber-300">
                            <GoldCoinCircle size={12} />
                            {u.cost.gold}
                          </span>
                          {u.cost.wood > 0 && <span>🪵{u.cost.wood}</span>}
                          {u.cost.stone > 0 && <span>🪨{u.cost.stone}</span>}
                          {u.cost.food ? <span>🌾{u.cost.food}</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. KEEP / GENERIC BUILDING MODE */}
            {activeBuilding && activeBuilding.type !== 'market' && activeBuilding.type !== 'barracks' && (
              <div className="space-y-3">
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-amber-300">{bConfig?.nameFa}</h4>
                    <span className="text-[10px] text-zinc-500 font-mono">ID: #{activeBuilding.id.slice(-4)}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">{bConfig?.descriptionFa}</p>

                  {/* HP Bar */}
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>سلامت سازه</span>
                      <span>{Math.floor(activeBuilding.hp)} / {activeBuilding.maxHp} HP</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${activeBuilding.repairing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(0, (activeBuilding.hp / activeBuilding.maxHp) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Repair Building Control */}
                {activeBuilding.repairing ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 animate-spin text-amber-400" />
                      در حال بازسازی... (۲۰ ثانیه)
                    </span>
                    <span className="font-mono text-[10px]">{Math.floor((activeBuilding.hp / activeBuilding.maxHp) * 100)}%</span>
                  </div>
                ) : activeBuilding.hp < activeBuilding.maxHp ? (
                  <button
                    onClick={() => onRepairBuilding(activeBuilding.id)}
                    className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-amber-300 font-bold transition flex items-center justify-center gap-2"
                  >
                    <Wrench className="w-4 h-4" />
                    شروع ترمیم و بازسازی (۳۰ 🪨 + ۳۰ 🪵)
                  </button>
                ) : null}
              </div>
            )}

            {/* 4. UNITS SELECTED MODE */}
            {selectedUnits.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-400" />
                      سربازان منتخب ({selectedUnits.length})
                    </h4>
                    <p className="text-[10px] text-zinc-500">برای حرکت یا حمله، روی مپ راست کلیک کنید</p>
                  </div>
                  <button
                    onClick={onSelectAllUnits}
                    className="px-2.5 py-1 bg-blue-600/20 border border-blue-500/40 rounded-lg text-blue-300 hover:bg-blue-600/40 font-bold text-[10px] transition"
                  >
                    انتخاب همه (S)
                  </button>
                </div>

                {/* Troop Roster breakdown */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {['swordsman', 'archer', 'spearman', 'knight'].map((typeKey) => {
                    const count = selectedUnits.filter((u) => u.type === typeKey).length;
                    if (count === 0) return null;
                    const uConfig = UNITS_CONFIG[typeKey as UnitType];
                    return (
                      <div key={typeKey} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between">
                        <span className="text-zinc-300">{uConfig.nameFa}</span>
                        <span className="font-mono font-bold text-blue-400">×{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. STANDBY / NOTHING SELECTED */}
            {!selectedBuilding && selectedUnits.length === 0 && (
              <div className="p-6 text-center text-zinc-500 space-y-2">
                <Building className="w-8 h-8 mx-auto text-zinc-700 animate-bounce" />
                <p className="text-xs">روی هر سازه (مانند بازار یا سربازخانه) یا سرباز کلیک کنید تا پنل جزییات فعال شود.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
