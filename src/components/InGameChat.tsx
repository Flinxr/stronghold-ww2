import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { PLAYERS_CONFIG } from '../game/constants';
import { MessageSquare, Send, X, ChevronUp, ChevronDown } from 'lucide-react';

interface InGameChatProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  selfPlayerId: number;
}

export function InGameChat({ messages, onSendMessage, selfPlayerId }: InGameChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMsg.trim()) {
      onSendMessage(inputMsg.trim());
      setInputMsg('');
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 font-sans dir-rtl text-right">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 border border-amber-500/40 text-amber-400 rounded-xl shadow-xl backdrop-blur-md text-xs font-bold flex items-center gap-2 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          <span>چت بازی آنلاین</span>
          {messages.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      ) : (
        <div className="w-80 bg-slate-950/95 border-2 border-amber-600/50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col h-72">
          {/* Header */}
          <div className="px-3 py-2 bg-slate-900 border-b border-amber-600/30 flex items-center justify-between text-xs font-bold text-amber-300">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> گفتگوی آنلاین بازی
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs">
            {messages.length === 0 ? (
              <p className="text-slate-500 text-center py-6 text-[11px]">هنوز پیامی ارسال نشده است.</p>
            ) : (
              messages.map((m, idx) => {
                const colorHex = m.playerId ? PLAYERS_CONFIG[m.playerId]?.colorCss : '#f59e0b';
                return (
                  <div key={idx} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="font-bold" style={{ color: colorHex }}>
                        {m.sender}:
                      </span>
                      <span className="text-slate-500">{m.time}</span>
                    </div>
                    <p className="text-slate-200 leading-snug break-words">{m.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="p-2 border-t border-slate-800 flex gap-1 bg-slate-900">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="پیام شما..."
              maxLength={100}
              className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg text-white text-xs outline-none"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg font-bold"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
