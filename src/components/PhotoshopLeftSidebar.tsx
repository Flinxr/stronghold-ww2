import React from 'react';
import { Resources, WaveInfo, BuildingType, BuildingInstance, UnitInstance } from '../types';
import { BUILDINGS_CONFIG } from '../game/constants';
import { soundManager } from '../game/audio';
import { MiniMap } from './MiniMap';
import { GoldCoinCircle } from './TopBar';
import {
  Hammer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Coins,
  Trees,
  Pickaxe,
  Wheat,
  Users,
  Play,
  Pause,
  FastForward,
  Volume2,
  VolumeX,
  HelpCircle,
  Home,
  Swords,
  TowerControl,
  Shield,
  Compass,
  X,
  Menu,
  Maximize,
  Minimize,
  Globe,
  LogOut,
} from 'lucide-react';

interface PhotoshopLeftSidebarProps {
  resources: Resources;
  waveInfo?: WaveInfo;
  activeBuildType: BuildingType | null;
  setActiveBuildType: (type: BuildingType | null) => void;
  gameSpeed: number;
  setGameSpeed: (speed: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenGuide: () => void;
  buildings: BuildingInstance[];
  units: UnitInstance[];
  cameraPos: { x: number; z: number };
  onMapClick: (x: number, z: number) => void;
  onOpenLobby?: () => void;
  onLeaveOnlineGame?: () => void;
  isOnline?: boolean;
  pingMs?: number | null;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="w-4 h-4 text-amber-400" />,
  Wheat: <Wheat className="w-4 h-4 text-orange-400" />,
  Pickaxe: <Pickaxe className="w-4 h-4 text-slate-300" />,
  Trees: <Trees className="w-4 h-4 text-emerald-400" />,
  Coins: <Coins className="w-4 h-4 text-yellow-400" />,
  Swords: <Swords className="w-4 h-4 text-red-400" />,
  TowerControl: <TowerControl className="w-4 h-4 text-indigo-400" />,
  Shield: <Shield className="w-4 h-4 text-blue-400" />,
};

export const PhotoshopLeftSidebar: React.FC<PhotoshopLeftSidebarProps> = ({
  resources,
  waveInfo,
  activeBuildType,
  setActiveBuildType,
  gameSpeed,
  setGameSpeed,
  isOpen,
  onToggleOpen,
  onOpenGuide,
  buildings,
  units,
  cameraPos,
  onMapClick,
  onOpenLobby,
  onLeaveOnlineGame,
  isOnline,
  pingMs,
}) => {
  const [isMuted, setIsMuted] = React.useState(soundManager.getMuted());
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'build' | 'defense' | 'menu'>('build');

  React.useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const buildingKeys: BuildingType[] = [
    'house',
    'farm',
    'woodcutter',
    'quarry',
    'goldmine',
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

  return (
    <aside
      className={`fixed top-3 left-3 z-40 transition-all duration-300 font-sans dir-rtl select-none ${
        isOpen ? 'w-80 md:w-88' : 'w-12'
      }`}
    >
      <div className="bg-zinc-950/90 backdrop-blur-2xl border border-zinc-800/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-zinc-100 flex flex-col max-h-[calc(100vh-1.5rem)]">
        {/* Title / Header Bar */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-3.5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleOpen}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
              title={isOpen ? 'بستن تولبار' : 'باز کردن تولبار'}
            >
              {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {isOpen && (
              <span className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                دژ مرزنشینان | تنظیمات و پنل
              </span>
            )}
          </div>
        </div>

        {/* Collapsed Icon Bar View */}
        {!isOpen && (
          <div className="p-2 flex flex-col items-center gap-3 py-4 text-zinc-400">
            {/* 1. Build Icon */}
            <button
              onClick={() => {
                setActiveTab('build');
                onToggleOpen();
              }}
              className={`p-1.5 rounded-xl transition ${
                activeTab === 'build' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-zinc-800/80 hover:text-zinc-200'
              }`}
              title="ساخت و ساز سازه‌ها"
            >
              <Hammer className="w-5 h-5 text-amber-400" />
            </button>

            {/* 2. Red Defense Icon */}
            <button
              onClick={() => {
                setActiveTab('defense');
                onToggleOpen();
              }}
              className={`p-1.5 rounded-xl transition ${
                activeTab === 'defense' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'hover:bg-zinc-800/80 hover:text-red-400'
              }`}
              title="دژ و نقشه تاکتیکی"
            >
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </button>

            {/* 3. Three-Lines Menu Icon (Right below the red icon) */}
            <button
              onClick={() => {
                setActiveTab('menu');
                onToggleOpen();
              }}
              className={`p-1.5 rounded-xl transition ${
                activeTab === 'menu' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'hover:bg-zinc-800/80 hover:text-amber-400'
              }`}
              title="استاپ بازی، تمام‌صفحه، صدا و تنظیمات (سه خط)"
            >
              <Menu className="w-5 h-5 text-zinc-200 hover:text-white" />
            </button>
          </div>
        )}

        {/* Expanded Left Panel Body */}
        {isOpen && (
          <>
            {/* 3 Tabs Switcher */}
            <div className="flex items-center bg-zinc-900/60 border-b border-zinc-800/80 p-1.5 gap-1 shrink-0 text-[11px] font-bold">
              <button
                onClick={() => setActiveTab('build')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition ${
                  activeTab === 'build'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                ساخت‌وساز
              </button>
              <button
                onClick={() => setActiveTab('defense')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition ${
                  activeTab === 'defense'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                دژ و نقشه
              </button>
              <button
                onClick={() => setActiveTab('menu')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition ${
                  activeTab === 'menu'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Menu className="w-3.5 h-3.5 text-blue-400" />
                کنترل و منو
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin scrollbar-thumb-zinc-800">
              {/* TAB 1: BUILDINGS PALETTE */}
              {activeTab === 'build' && (
                <>
                  {/* KINGDOM RESOURCES SUMMARY */}
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-[11px] uppercase text-zinc-400 tracking-wider">موجودی انبار دژ</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-800/60 flex items-center justify-between">
                        <span className="text-amber-400 font-bold flex items-center gap-1.5">
                          <GoldCoinCircle size={14} /> طلا
                        </span>
                        <span className="text-zinc-100 font-bold">{resources.gold}</span>
                      </div>
                      <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-800/60 flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">🪵 چوب</span>
                        <span className="text-zinc-100 font-bold">{resources.wood}</span>
                      </div>
                      <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-800/60 flex items-center justify-between">
                        <span className="text-zinc-300 font-bold">🪨 سنگ</span>
                        <span className="text-zinc-100 font-bold">{resources.stone}</span>
                      </div>
                      <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-800/60 flex items-center justify-between">
                        <span className="text-orange-400 font-bold">🌾 غذا</span>
                        <span className="text-zinc-100 font-bold">{resources.food}</span>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-zinc-400 font-mono text-[11px]">
                      <span>جمعیت کل:</span>
                      <span className="text-blue-300 font-bold">👥 {resources.population} / {resources.maxPopulation}</span>
                    </div>
                  </div>

                  {/* BUILDING SHOP PALETTE */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[11px] uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                        <Hammer className="w-3.5 h-3.5 text-amber-400" />
                        ساخت و ساز سازه‌ها
                      </h4>
                      {activeBuildType && (
                        <button
                          onClick={() => setActiveBuildType(null)}
                          className="text-red-400 hover:text-red-300 text-[10px] font-bold"
                        >
                          لغو انتخاب
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {buildingKeys.map((key) => {
                        const b = BUILDINGS_CONFIG[key];
                        const affordable = canAfford(key);
                        const isSelected = activeBuildType === key;

                        return (
                          <div
                            key={key}
                            onClick={() => {
                              if (affordable) {
                                soundManager.playClick();
                                setActiveBuildType(isSelected ? null : key);
                              }
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                : affordable
                                ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                                : 'bg-zinc-900/20 border-zinc-900 opacity-40 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
                                {ICON_MAP[b.icon]}
                              </div>
                              <div>
                                <h5 className="font-bold text-xs text-zinc-200">{b.nameFa}</h5>
                                <span className="text-[9px] text-zinc-500">{b.sizeX}×{b.sizeZ} کاشی</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] font-mono">
                              {b.cost.gold > 0 && (
                                <span className="text-amber-300 flex items-center gap-0.5">
                                  <GoldCoinCircle size={12} />
                                  {b.cost.gold}
                                </span>
                              )}
                              {b.cost.wood > 0 && <span className="text-emerald-300">🪵{b.cost.wood}</span>}
                              {b.cost.stone > 0 && <span className="text-zinc-300">🪨{b.cost.stone}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: DEFENSE & MAP */}
              {activeTab === 'defense' && (
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-[11px] uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      وضعیت دژ و مواضع دفاعی
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      از مینی‌مپ زیر برای جابجایی سریع دوربین بر فراز پایگاه و نظارت بر وضعیت ساختمان‌ها و نیروهای پادگان استفاده کنید.
                    </p>
                  </div>

                  {/* EMBEDDED TACTICAL MAP */}
                  <div className="pt-1">
                    <MiniMap
                      buildings={buildings}
                      units={units}
                      cameraPos={cameraPos}
                      onMapClick={onMapClick}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: THREE-LINES MENU (Pause, Fullscreen, Mute, Lobby, Guide) */}
              {activeTab === 'menu' && (
                <div className="space-y-3">
                  {/* 1. SPEED & PAUSE CONTROLS */}
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-zinc-300 flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-amber-400" />
                        کنترل زمان و توقف بازی
                      </span>
                      <span className="text-[10px] font-mono text-amber-300">
                        {gameSpeed === 0 ? 'بازی متوقف' : gameSpeed === 1 ? 'سرعت 1x' : 'سرعت 2x'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setGameSpeed(0)}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition ${
                          gameSpeed === 0
                            ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                            : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:bg-zinc-900'
                        }`}
                        title="توقف بازی (Pause)"
                      >
                        <Pause className="w-4 h-4" />
                        <span className="text-[10px]">استاپ بازی</span>
                      </button>
                      <button
                        onClick={() => setGameSpeed(1)}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition ${
                          gameSpeed === 1
                            ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                            : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:bg-zinc-900'
                        }`}
                        title="سرعت عادی (1x)"
                      >
                        <Play className="w-4 h-4" />
                        <span className="text-[10px]">سرعت عادی</span>
                      </button>
                      <button
                        onClick={() => setGameSpeed(2)}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition ${
                          gameSpeed === 2
                            ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                            : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:bg-zinc-900'
                        }`}
                        title="سرعت سریع (2x)"
                      >
                        <FastForward className="w-4 h-4" />
                        <span className="text-[10px]">سرعت ۲ برابر</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. FULLSCREEN TOGGLE */}
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                    <span className="font-bold text-[11px] text-zinc-300 flex items-center gap-1.5">
                      <Maximize className="w-3.5 h-3.5 text-blue-400" />
                      نمایش تمام‌صفحه
                    </span>
                    <button
                      onClick={toggleFullscreen}
                      className="w-full py-2.5 px-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-zinc-200 transition"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {isFullscreen ? (
                          <Minimize className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Maximize className="w-4 h-4 text-blue-400" />
                        )}
                        <span>{isFullscreen ? 'خروج از حالت تمام‌صفحه' : 'فول اسکرین کردن بازی'}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isFullscreen ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                        {isFullscreen ? 'تمام‌صفحه' : 'عادی'}
                      </span>
                    </button>
                  </div>

                  {/* 3. MUTE / UNMUTE SOUND */}
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                    <span className="font-bold text-[11px] text-zinc-300 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      صدا و موسیقی بازی
                    </span>
                    <button
                      onClick={handleToggleMute}
                      className="w-full py-2.5 px-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-zinc-200 transition"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-red-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>{isMuted ? 'قطع کردن صدا (صدا قطع است)' : 'وصل بودن صدا (صدا پخش می‌شود)'}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isMuted ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {isMuted ? 'بی‌صدا' : 'پخش صدا'}
                      </span>
                    </button>
                  </div>

                  {/* 4. ONLINE LOBBY & GUIDE */}
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                    <span className="font-bold text-[11px] text-zinc-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      لابی آنلاین و راهنما
                    </span>
                    <div className="space-y-2">
                      {onOpenLobby && (
                        <button
                          onClick={onOpenLobby}
                          className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 flex items-center justify-between text-amber-300 transition"
                        >
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <Globe className="w-4 h-4 text-amber-400" />
                            <span>لابی و اتاق‌های آنلاین</span>
                          </div>
                          {isOnline ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                              متصل {pingMs != null && `(${pingMs}ms)`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400">ورود</span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={onOpenGuide}
                        className="w-full py-2.5 px-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-zinc-200 transition"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <HelpCircle className="w-4 h-4 text-amber-400" />
                          <span>راهنمای استراتژی و بازی</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">مشاهده</span>
                      </button>

                      {/* 5. EXIT GAME / RETURN TO LOBBY */}
                      <button
                        onClick={() => {
                          if (onLeaveOnlineGame) {
                            onLeaveOnlineGame();
                          } else if (onOpenLobby) {
                            onOpenLobby();
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-950/70 to-red-900/60 hover:from-red-900/80 hover:to-red-800/80 border border-red-500/50 flex items-center justify-between text-red-200 transition shadow-lg shadow-red-950/40"
                      >
                        <div className="flex items-center gap-2 text-xs font-black">
                          <LogOut className="w-4 h-4 text-red-400" />
                          <span>خروج از بازی و بازگشت به لابی</span>
                        </div>
                        <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded font-bold">
                          خروج
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

