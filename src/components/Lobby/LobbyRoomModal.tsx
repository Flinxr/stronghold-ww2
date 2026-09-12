import React, { useState } from 'react';
import { LobbyRoomData, LobbyPlayer, ChatMessage } from '../../types';
import { PLAYERS_CONFIG } from '../../game/constants';
import { Shield, Lock, Coins, Users, CheckCircle2, Send, LogOut, Play, Edit2, Crown } from 'lucide-react';

interface LobbyRoomModalProps {
  lobby: LobbyRoomData;
  selfPlayerId: number;
  socketId: string;
  chatMessages: ChatMessage[];
  onUpdateSettings: (settings: { name?: string; startingGold?: number; maxPlayers?: number }) => void;
  onUpdatePlayerName?: (newName: string) => void;
  onChangeSlot: (newSlot: number) => void;
  onToggleReady: () => void;
  onSendMessage: (msg: string) => void;
  onStartGame: () => void;
  onLeaveLobby: () => void;
}

export function LobbyRoomModal({
  lobby,
  selfPlayerId,
  socketId,
  chatMessages,
  onUpdateSettings,
  onUpdatePlayerName,
  onChangeSlot,
  onToggleReady,
  onSendMessage,
  onStartGame,
  onLeaveLobby,
}: LobbyRoomModalProps) {
  const [editingName, setEditingName] = useState(false);
  const [lobbyNameInput, setLobbyNameInput] = useState(lobby.name);
  const [chatInput, setChatInput] = useState('');
  const [editingPlayerName, setEditingPlayerName] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState('');

  const selfPlayer = lobby.players.find((p) => p.id === socketId);
  const isHost = selfPlayer?.isHost || false;

  const handleNameSave = () => {
    if (lobbyNameInput.trim()) {
      onUpdateSettings({ name: lobbyNameInput.trim() });
    }
    setEditingName(false);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  // Build array of slots based on lobby.maxPlayers
  const slots = Array.from({ length: lobby.maxPlayers }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[750px] bg-slate-900 border-2 border-amber-600/60 rounded-2xl shadow-2xl overflow-hidden font-sans dir-rtl text-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-amber-600/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/20 rounded-xl border border-amber-500/40 text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {editingName && isHost ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={lobbyNameInput}
                      onChange={(e) => setLobbyNameInput(e.target.value)}
                      maxLength={30}
                      className="px-2 py-1 bg-slate-900 border border-amber-500 rounded text-amber-300 text-base font-bold outline-none"
                    />
                    <button
                      onClick={handleNameSave}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs"
                    >
                      ثبت
                    </button>
                  </div>
                ) : (
                  <h3 className="text-xl font-bold text-amber-300 flex items-center gap-2">
                    <span>{lobby.name}</span>
                    {isHost && (
                      <button
                        onClick={() => setEditingName(true)}
                        className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                        title="تغییر نام لابی"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </h3>
                )}
                {lobby.password && (
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-md text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> رمزدار
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ظرفیت: {lobby.players.length} از {lobby.maxPlayers} نفر | طلای اولیه: {lobby.startingGold} 🪙
              </p>
            </div>
          </div>

          <button
            onClick={onLeaveLobby}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            خروج از لابی
          </button>
        </div>

        {/* Content Main Split (Left: Slots & Options, Right: Lobby Chat) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 p-5 overflow-hidden">
          {/* Slots & Settings Column */}
          <div className="md:col-span-2 flex flex-col justify-between space-y-4 overflow-y-auto pr-1">
            {/* Host Settings Controls (If Host) */}
            {isHost && (
              <div className="p-3.5 bg-slate-950/80 border border-amber-600/30 rounded-xl space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Crown className="w-4 h-4" /> تنظیمات لابی (مخصوص میزبان):
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  {/* Change Starting Gold */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">طلای اولیه:</span>
                    <div className="flex gap-1">
                      {[300, 500, 1000, 2000, 5000].map((gold) => (
                        <button
                          key={gold}
                          onClick={() => onUpdateSettings({ startingGold: gold })}
                          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                            lobby.startingGold === gold
                              ? 'bg-amber-600 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {gold}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Change Max Players */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">تعداد بازیکن:</span>
                    <div className="flex gap-1">
                      {[2, 3, 4].map((count) => (
                        <button
                          key={count}
                          onClick={() => onUpdateSettings({ maxPlayers: count })}
                          className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                            lobby.maxPlayers === count
                              ? 'bg-amber-600 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {count} نفره
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slots List */}
            <div className="space-y-3 flex-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                جایگاه‌های بازیکنان و تیم‌ها (برای انتخاب رنگ کلیک کنید):
              </h4>

              <div className="grid grid-cols-1 gap-2.5">
                {slots.map((slotNum) => {
                  const occupant = lobby.players.find((p) => p.playerId === slotNum);
                  const cfg = PLAYERS_CONFIG[slotNum];
                  const isCurrentSelf = occupant?.id === socketId;

                  return (
                    <div
                      key={slotNum}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        occupant
                          ? isCurrentSelf
                            ? 'bg-slate-950 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-950/70 border-slate-800'
                          : 'bg-slate-950/40 border-dashed border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Player / Slot Info */}
                      <div className="flex items-center gap-3">
                        {/* Team Color Badge */}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-inner"
                          style={{ backgroundColor: cfg.colorCss }}
                        >
                          {slotNum}
                        </div>

                        {occupant ? (
                          <div>
                            <div className="flex items-center gap-2">
                              {isCurrentSelf && editingPlayerName ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={playerNameInput}
                                    onChange={(e) => setPlayerNameInput(e.target.value)}
                                    maxLength={20}
                                    autoFocus
                                    className="px-2 py-0.5 bg-slate-900 border border-amber-500 rounded text-amber-300 text-xs font-bold outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (playerNameInput.trim() && onUpdatePlayerName) {
                                          onUpdatePlayerName(playerNameInput.trim());
                                        }
                                        setEditingPlayerName(false);
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      if (playerNameInput.trim() && onUpdatePlayerName) {
                                        onUpdatePlayerName(playerNameInput.trim());
                                      }
                                      setEditingPlayerName(false);
                                    }}
                                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded text-xs font-bold"
                                  >
                                    ثبت
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-sm font-bold text-white">{occupant.name}</span>
                                  {isCurrentSelf && onUpdatePlayerName && (
                                    <button
                                      onClick={() => {
                                        setPlayerNameInput(occupant.name);
                                        setEditingPlayerName(true);
                                      }}
                                      className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                                      title="تغییر نام خودتان"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                              {occupant.isHost && (
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                                  <Crown className="w-3 h-3" /> میزبان
                                </span>
                              )}
                              {isCurrentSelf && (
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold border border-blue-500/30">
                                  شما
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              رنگ {cfg.nameFa}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs font-semibold text-slate-500">جایگاه خالی {slotNum}</span>
                            <span className="text-[11px] text-slate-600 block">رنگ {cfg.nameFa}</span>
                          </div>
                        )}
                      </div>

                      {/* Action / Status */}
                      <div>
                        {occupant ? (
                          <div className="flex items-center gap-2">
                            {occupant.isReady ? (
                              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> آماده
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs font-medium">
                                در حال انتظار...
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => onChangeSlot(slotNum)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-amber-600 hover:text-slate-950 text-amber-400 rounded-lg text-xs font-bold transition-all"
                          >
                            تغییر به تیم {slotNum}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              {!isHost && (
                <button
                  onClick={onToggleReady}
                  className={`py-3 px-6 rounded-xl text-sm font-extrabold transition-all flex items-center gap-2 ${
                    selfPlayer?.isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-lg shadow-amber-600/20'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {selfPlayer?.isReady ? 'اعلام آمادگی شد (لغو)' : 'آماده هستم برای نبرد'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={onStartGame}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-base font-black shadow-xl shadow-amber-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  شروع بازی آنلاین
                </button>
              )}
            </div>
          </div>

          {/* Lobby Chat Column */}
          <div className="md:col-span-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between overflow-hidden">
            <h4 className="text-xs font-bold text-amber-400 border-b border-slate-800 pb-2 mb-2 flex items-center justify-between">
              <span>گفتگوی لابی (چت):</span>
              <span className="text-[10px] text-slate-500">{chatMessages.length} پیام</span>
            </h4>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs mb-3">
              {chatMessages.length === 0 ? (
                <p className="text-slate-600 text-center py-8">هنوز پیامی ارسال نشده است.</p>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-amber-300">{msg.sender}:</span>
                      <span className="text-[10px] text-slate-500">{msg.time}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed break-words">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="flex gap-1.5 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="پیام شما..."
                maxLength={100}
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg text-white text-xs outline-none"
              />
              <button
                type="submit"
                className="p-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
