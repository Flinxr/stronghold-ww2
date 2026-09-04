import React, { useState } from 'react';
import { Shield, Lock, Coins, Users, Swords, X } from 'lucide-react';

interface CreateLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    password?: string;
    maxPlayers: number;
    startingGold: number;
    hostName: string;
  }) => void;
}

export function CreateLobbyModal({ isOpen, onClose, onCreate }: CreateLobbyModalProps) {
  const [hostName, setHostName] = useState('فرمانده ۱');
  const [lobbyName, setLobbyName] = useState('دژ جنگجویان');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [startingGold, setStartingGold] = useState<number>(500);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name: lobbyName.trim() || 'دژ نبرد',
      password: password.trim() || undefined,
      maxPlayers,
      startingGold,
      hostName: hostName.trim() || 'فرمانده',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-600/60 rounded-2xl shadow-2xl overflow-hidden font-sans dir-rtl text-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-amber-600/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600/20 rounded-lg border border-amber-500/40 text-amber-400">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-300">ساخت لابی جدید آنلاین</h3>
              <p className="text-xs text-slate-400">تنظیمات نبرد آنلاین را تعیین کنید</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Host Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              نام فرمانده شما (میزبان):
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="نام فرمانده..."
              maxLength={20}
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-white text-sm outline-none transition-all focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Lobby Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              نام لابی / اتاق:
            </label>
            <input
              type="text"
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
              placeholder="مثال: نبرد سرنوشت‌ساز..."
              maxLength={30}
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-white text-sm outline-none transition-all focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                رمز عبور لابی (اختیاری):
              </label>
              <span className="text-[11px] text-slate-400">مانند سرورهای کانتر ۱.۶ (خالی = عمومی)</span>
            </div>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="برای عمومی ماندن لابی، خالی بگذارید..."
              maxLength={20}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-white text-sm outline-none transition-all focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Max Players (2, 3, or 4) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              تعداد بازیکنان بازی (۲، ۳ یا ۴ قلعه در نقشه):
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMaxPlayers(count)}
                  className={`py-2.5 px-3 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${
                    maxPlayers === count
                      ? 'bg-amber-600/30 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{count} نفره</span>
                  <span className="text-[10px] font-normal text-slate-400">({count} قلعه)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Starting Gold */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              منابع طلای اولیه شروع بازی:
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[300, 500, 1000, 2000, 5000].map((gold) => (
                <button
                  key={gold}
                  type="button"
                  onClick={() => setStartingGold(gold)}
                  className={`py-2 px-1 rounded-xl border text-xs font-bold text-center transition-all ${
                    startingGold === gold
                      ? 'bg-amber-600/30 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {gold} 🪙
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-sm font-extrabold shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              ساخت لابی و ورود
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
