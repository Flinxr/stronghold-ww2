import React, { useState } from 'react';
import { PublicLobbyInfo } from '../../types';
import { Shield, Lock, Coins, Users, RefreshCw, Plus, Play, Search, Key, X, Swords } from 'lucide-react';

interface LobbyListModalProps {
  isOpen: boolean;
  lobbies: PublicLobbyInfo[];
  onRefresh: () => void;
  onCreateLobbyClick: () => void;
  onJoinLobby: (lobbyId: string, password?: string) => void;
  onPlayOffline: () => void;
}

export function LobbyListModal({
  isOpen,
  lobbies,
  onRefresh,
  onCreateLobbyClick,
  onJoinLobby,
  onPlayOffline,
}: LobbyListModalProps) {
  const [activeTab, setActiveTab] = useState<'online' | 'offline'>('online');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLobbyForPassword, setSelectedLobbyForPassword] = useState<PublicLobbyInfo | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const filteredLobbies = lobbies.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.hostName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAttemptJoin = (lobby: PublicLobbyInfo) => {
    setErrorMessage('');
    if (lobby.hasPassword) {
      setSelectedLobbyForPassword(lobby);
      setPasswordInput('');
    } else {
      onJoinLobby(lobby.id);
    }
  };

  const handleConfirmPasswordJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLobbyForPassword) {
      onJoinLobby(selectedLobbyForPassword.id, passwordInput.trim());
      setSelectedLobbyForPassword(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] max-h-[700px] bg-slate-900 border-2 border-amber-600/60 rounded-2xl shadow-2xl overflow-hidden font-sans dir-rtl text-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-amber-600/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/20 rounded-xl border border-amber-500/40 text-amber-400">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-300">منوی اصلی و لابی نبرد آنلاین</h3>
              <p className="text-xs text-slate-400">حالت بازی خود را انتخاب کنید یا به لابی‌های آنلاین بپیوندید</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPlayOffline}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-white" />
              شروع سریع تک‌نفره (آفلایین)
            </button>
            <button
              onClick={onCreateLobbyClick}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              ساخت لابی جدید
            </button>
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('online')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'online'
                  ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-600/20'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              لابی‌های آنلاین (Multiplayer)
              <span className="px-1.5 py-0.5 bg-black/30 rounded text-[10px] font-mono">
                {lobbies.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('offline')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'offline'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Play className="w-4 h-4" />
              بازی تک‌نفره (آفلایین)
            </button>
          </div>

          {activeTab === 'online' && (
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجوی لابی..."
                  className="w-full pr-8 pl-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl text-white text-xs outline-none transition-all"
                />
              </div>

              <button
                onClick={onRefresh}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                به‌روزرسانی
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'offline' ? (
            /* Single Player / Offline View */
            <div className="max-w-2xl mx-auto py-6 space-y-6 text-center">
              <div className="p-4 bg-emerald-950/40 border-2 border-emerald-600/40 rounded-2xl">
                <div className="w-16 h-16 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 fill-emerald-400" />
                </div>
                <h4 className="text-xl font-extrabold text-emerald-300 mb-2">
                  نبرد تک‌نفره علیه هوش مصنوعی (Single-Player)
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed max-w-lg mx-auto mb-6">
                  در این حالت شما به عنوان پادشاهی قلمرو ۱، به مبارزه و رقابت با هوش مصنوعی (بازیکن ۲) می‌پردازید. بدون نیاز به شبکه و اینترنت می‌توانید سریعاً بازی را آغاز کنید.
                </p>

                <div className="grid grid-cols-2 gap-3 text-right max-w-md mx-auto mb-8 text-xs text-slate-300">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span> ۵ سرباز اولیه در شروع نبرد
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span> ۳۰۰ سکه طلا برای ساخت و ساز
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span> امواج حمله دشمنان
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span> هوش مصنوعی هوشمند و تهاجمی
                  </div>
                </div>

                <button
                  onClick={onPlayOffline}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-600/30 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                >
                  <Play className="w-5 h-5 fill-white" />
                  شروع بازی تک‌نفره (آفلایین)
                </button>
              </div>
            </div>
          ) : (
            /* Online Lobbies View */
            <div className="space-y-3">
              {filteredLobbies.length === 0 ? (
                <div className="text-center py-16 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-300 mb-1">هیچ لابی فعالی یافت نشد!</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    اولین لابی را شما بسازید تا بقیه بازیکنان به آن بپیوندند، یا روی بروزرسانی کلیک کنید.
                  </p>
                  <button
                    onClick={onCreateLobbyClick}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20"
                  >
                    ساخت اولین لابی آنلاین
                  </button>
                </div>
              ) : (
                filteredLobbies.map((lobby) => (
                  <div
                    key={lobby.id}
                    className="p-4 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl transition-all flex items-center justify-between gap-4"
                  >
                    {/* Lobby Main Info */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-600/10 rounded-lg text-amber-400 border border-amber-500/20">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{lobby.name}</span>
                          {lobby.hasPassword && (
                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded text-[10px] font-bold flex items-center gap-1">
                              <Lock className="w-3 h-3" /> رمزدار
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          میزبان: <strong className="text-slate-300">{lobby.hostName}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Badges / Stats */}
                    <div className="flex items-center gap-6 text-xs">
                      {/* Players Count */}
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Users className="w-4 h-4 text-amber-400" />
                        <span>
                          ظرفیت: <strong>{lobby.currentPlayers}</strong> / {lobby.maxPlayers} نفر
                        </span>
                      </div>

                      {/* Gold */}
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>طلا: {lobby.startingGold}</span>
                      </div>

                      {/* Status */}
                      <div>
                        {lobby.status === 'waiting' ? (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-semibold">
                            در حال انتظار
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-semibold">
                            در حال بازی
                          </span>
                        )}
                      </div>

                      {/* Join Action */}
                      <button
                        onClick={() => handleAttemptJoin(lobby)}
                        disabled={lobby.status !== 'waiting' || lobby.currentPlayers >= lobby.maxPlayers}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-extrabold rounded-xl transition-all shadow-md shadow-amber-600/10"
                      >
                        {lobby.currentPlayers >= lobby.maxPlayers ? 'تکمیل' : 'ورود به لابی'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Password Prompt Modal if Locked Lobby */}
      {selectedLobbyForPassword && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-600/80 rounded-2xl p-6 text-right dir-rtl font-sans shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                ورود به لابی رمزدار
              </h4>
              <button
                onClick={() => setSelectedLobbyForPassword(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              لابی «<strong className="text-white">{selectedLobbyForPassword.name}</strong>» دارای رمز عبور است. لطفاً رمز عبور را وارد کنید:
            </p>

            <form onSubmit={handleConfirmPasswordJoin} className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="رمز عبور لابی..."
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-white text-sm outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLobbyForPassword(null)}
                  className="w-1/3 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl"
                >
                  ورود
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
