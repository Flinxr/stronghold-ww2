import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GameStats } from '../types';
import { Trophy, Skull, RefreshCw, Swords, Shield, Clock, Award } from 'lucide-react';

interface GameOverModalProps {
  isVictory: boolean;
  stats: GameStats;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isVictory,
  stats,
  onRestart,
}) => {
  useEffect(() => {
    if (isVictory) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isVictory]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m} دقیقه و ${s} ثانیه`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 dir-rtl font-sans animate-fade-in">
      <div className="bg-black/85 border border-white/20 rounded-3xl p-6 max-w-md w-full text-center text-zinc-100 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        {/* Glow backdrop */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl ${
            isVictory ? 'bg-amber-500/30' : 'bg-red-600/30'
          }`}
        />

        {/* Icon */}
        <div className="relative inline-flex items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-xl">
          {isVictory ? (
            <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
          ) : (
            <Skull className="w-12 h-12 text-red-500 animate-pulse" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-zinc-100 mb-1 tracking-wide">
          {isVictory ? 'پیروزی بزرگ قلعه!' : 'شکست دژ و سقوط قلمرو!'}
        </h2>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          {isVictory
            ? 'شما تمامی امواج مهاجمان را سرکوب کردید و از مرزهای کشور دفاع نمودید.'
            : 'دژ اصلی شما توسط ارتش متجاوز دشمن نابود شد.'}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-right">
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Swords className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">دشمنان کشته‌شده</div>
              <div className="font-bold text-sm font-mono text-zinc-200">{stats.enemiesKilled} نفر</div>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Shield className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">ساختمان‌های بنا شده</div>
              <div className="font-bold text-sm font-mono text-zinc-200">{stats.buildingsConstructed} عدد</div>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">نیروهای جذب‌شده</div>
              <div className="font-bold text-sm font-mono text-zinc-200">{stats.unitsRecruited} سرباز</div>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">مدت زمان بقا</div>
              <div className="font-bold text-xs font-mono text-zinc-200">{formatTime(stats.timeSurvivedSec)}</div>
            </div>
          </div>
        </div>

        {/* Restart Button */}
        <button
          onClick={onRestart}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
        >
          <RefreshCw className="w-4 h-4" />
          شروع مجدد بازی
        </button>
      </div>
    </div>
  );
};
