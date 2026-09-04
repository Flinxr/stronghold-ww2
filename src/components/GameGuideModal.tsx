import React from 'react';
import { X, MousePointer, ShieldAlert, Swords, Castle, Hammer } from 'lucide-react';

interface GameGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GameGuideModal: React.FC<GameGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 dir-rtl font-sans">
      <div className="bg-black/85 border border-white/20 rounded-3xl max-w-lg w-full p-6 text-zinc-100 shadow-2xl relative max-h-[90vh] overflow-y-auto backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Castle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wider">راهنمای بازی دژ مرزنشینان</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3.5 text-xs leading-relaxed text-zinc-300">
          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              هدف اصلی بازی
            </h3>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              از دژ اصلی (مرکز فرماندهی) در برابر ۵ موج متوالی از حملات متجاوزین دشمن دفاع کنید. با ساخت خانه‌ها، جمعیت خود را افزایش دهید و با احداث معادن و مزارع، منابع طلا، چوب، سنگ و غذا ذخیره کنید.
            </p>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-400 mb-1.5 flex items-center gap-1.5">
              <MousePointer className="w-4 h-4 text-blue-400" />
              کنترل‌ها و کلیدهای میانبر
            </h3>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
              <li><strong className="text-zinc-200">کلید چپ موش (Left Click):</strong> انتخاب سربازان یا کلیک روی زمین/ساختمان‌ها.</li>
              <li><strong className="text-zinc-200">درگ موش (Box Select):</strong> کادر کشیدن برای انتخاب همزمان چندین سرباز.</li>
              <li><strong className="text-zinc-200">کلید راست موش (Right Click):</strong> دستور حرکت یا حمله به موقعیت کلیک شده.</li>
              <li><strong className="text-zinc-200">کلید S:</strong> انتخاب تمامی سربازان خودی در نقشه.</li>
              <li><strong className="text-zinc-200">کلید Esc:</strong> لغو حالت ساخت یا لغو انتخاب.</li>
              <li><strong className="text-zinc-200">کلید Space:</strong> توقف یا ادامه بازی (Pause/Play).</li>
            </ul>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
            <h3 className="font-bold text-xs uppercase tracking-wider text-red-400 mb-1.5 flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-red-400" />
              انواع سربازان و راهبرد رزمی
            </h3>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
              <li><strong className="text-zinc-200">شمشیرزن (Swordsman):</strong> نیروی پیاده با شمشیر و سپر، مناسب خط مقدم.</li>
              <li><strong className="text-zinc-200">نیزه‌دار (Spearman):</strong> جان بیشتر و برد ضربه بیشتر برای جلوگيری از پیشروی.</li>
              <li><strong className="text-zinc-200">کماندار (Archer):</strong> نیروی دورزن. پشت دیوارهای دژ یا برج‌ها مستقر کنید تا از راه دور تیراندازی کنند.</li>
              <li><strong className="text-zinc-200">شوالیه (Knight):</strong> نیروی ویژه سریع و سنگین برای نابودی غول‌های دشمن.</li>
            </ul>
          </div>

          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1.5">
              <Hammer className="w-4 h-4 text-emerald-400" />
              ساختمان‌های سنگین دفاعی
            </h3>
            <p className="text-zinc-300 text-[11px]">
              با احداث <strong className="text-zinc-200">برج‌های دیده‌بانی</strong> تیرهای خودکار به دشمنان شلیک می‌شود. با ساخت <strong className="text-zinc-200">دیوارهای سنگین</strong> مسیر حرکت مهاجمان را مسدود و آنها را به تله بیندازید!
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(59,130,246,0.3)]"
        >
          فهمیدم، بازگشت به میدان نبرد!
        </button>
      </div>
    </div>
  );
};
