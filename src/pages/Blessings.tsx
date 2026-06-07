import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart, Sun, Feather, Send, History, Loader2, Wand2 } from 'lucide-react';
import { DailyBlessing, Settings } from '../types';
import { cn } from '../lib/utils';
import { generateBlessing } from '../services/geminiService';
import { translations } from '../lib/translations';

const DEFAULT_BLESSINGS = [
  {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",
    translation: "O Allah, I ask You for beneficial knowledge, wholesome provision, and deeds that are accepted.",
  },
  {
    arabic: "اللَّهُمَّ اغْفِرْ لِي، وَارْحَمْنِي، وَاهْدِنِي، وَعَافِنِي، وَارْزُقْنِي",
    translation: "O Allah, forgive me, have mercy on me, guide me, grant me health and provide for me.",
  },
  {
    arabic: "بِاسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ، لا حَوْلَ وَلا قُوَّةَ إِلا باللَّهِ",
    translation: "In the name of Allah, I place my trust in Allah; there is no might or power except with Allah.",
  },
  {
    arabic: "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ",
    translation: "O Allah, suffice me with Your lawful against Your prohibited, and make me independent of all those other than You through Your grace.",
  },
  {
    arabic: "رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي ۚ رَبَّنا وَتَقَبَّلْ دُعاء",
    translation: "My Lord, make me an establisher of prayer, and from my descendants. Our Lord, and accept my supplication.",
  },
  {
    arabic: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ",
    translation: "O Ever-Living, O Sustainer, in Your mercy I seek relief. Correct all my affairs and do not leave me to myself even for the blink of an eye.",
  },
  {
    arabic: "اللَّهُمَّ بَارِكْ لِي فِي تِجَارَتِي، وَاجْعَلْ فِيهَا الْخَيْرَ وَالْبَرَكَةَ",
    translation: "O Allah, bless my trade and place in it goodness and blessings.",
  },
  {
    arabic: "اللَّهُمَّ اهْدِنِي لِأَحْسَنِ الْأَخْلَاقِ وَأَصْدِقِ الْحَدِيثِ فِي الْبَيْعِ وَالشِّرَاءِ",
    translation: "O Allah, guide me to the best character and truthful speech in buying and selling.",
  },
  {
    arabic: "اللَّهُمَّ يَا رَزَّاقُ، يَا فَتَّاحُ، افْتَحْ لِي أَبْوَابَ رِزْقِكَ",
    translation: "O Allah, O Provider, O Opener, open for me the doors of Your provision.",
  },
  {
    arabic: "اللَّهُمَّ اجْعَلْ هَذَا الْمَحَلَّ مَحَلَّ بَرَكَةٍ وَخَيْرٍ لِلسَّائِلِينَ",
    translation: "O Allah, make this shop a place of blessing and goodness for all who come.",
  },
  {
    arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
    translation: "Allah is sufficient for us, and He is the best Disposer of affairs.",
  },
  {
    arabic: "رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا",
    translation: "Our Lord, grant us from Yourself mercy and prepare for us from our affair right guidance.",
  }
];

interface BlessingsProps {
  blessings: DailyBlessing[];
  setBlessings: React.Dispatch<React.SetStateAction<DailyBlessing[]>>;
  settings: Settings;
}

import { useFirebase } from '../components/FirebaseProvider';
import { saveData } from '../lib/dataService';

export const Blessings: React.FC<BlessingsProps> = ({ blessings, settings }) => {
  const { user } = useFirebase();
  const t = translations[settings.language] || translations.en;
  const [newOffering, setNewOffering] = useState('');
  const [newBlessing, setNewBlessing] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const result = await generateBlessing(newOffering);
    if (result) {
      setNewBlessing(result);
    }
    setIsGenerating(false);
  };

  const addOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newBlessing && !newOffering) || !user) return;

    const blessing: DailyBlessing = {
      id: crypto.randomUUID(),
      text: newBlessing || DEFAULT_BLESSINGS[Math.floor(Math.random() * DEFAULT_BLESSINGS.length)].arabic,
      offering: newOffering || 'Kindness',
      date: new Date().toISOString()
    };

    await saveData(user.uid, 'blessings', blessing);
    setNewBlessing('');
    setNewOffering('');
  };

  // Find the text for today's view (handle rotating default highlight)
  const todayHighlightIndex = new Date().getDate() % DEFAULT_BLESSINGS.length;
  const dailyHighlight = DEFAULT_BLESSINGS[todayHighlightIndex];

  const todayRaw = blessings[0];
  const todayDisplay = todayRaw ? todayRaw.text : dailyHighlight.arabic;
  
  // Try to find translation if it's one of ours
  const todayTranslation = DEFAULT_BLESSINGS.find(b => b.arabic === todayDisplay)?.translation || 
                           (todayRaw ? "" : dailyHighlight.translation);

  return (
    <div className="space-y-12 pb-20">
      <header className="text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-4 inline-flex rounded-full bg-orange-500/20 p-4"
        >
          <Sparkles className="h-8 w-8 text-orange-400" />
        </motion.div>
        <h1 className="text-4xl font-light tracking-tight md:text-6xl">
          {t.blessings.split(' ')[0]} <span className="font-medium text-orange-400">{t.blessings.split(' ').slice(1).join(' ') || 'Records'}</span>
        </h1>
        <p className="mt-2 text-white/60 italic">{t.blessingsSubtitle}</p>
      </header>

      {/* Daily Suggested Reading Highlight */}
      <section className="mx-auto max-w-2xl px-4">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-400/80">
          <Sun className="h-3 w-3" />
          {t.todaysPrayer}
        </div>
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative overflow-hidden rounded-[40px] border border-orange-500/30 bg-orange-500/5 p-8 md:p-12 text-center backdrop-blur-xl shadow-2xl shadow-orange-500/5"
        >
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-orange-500/10 to-transparent opacity-30" />
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-6">
              <p className={cn(
                "text-2xl font-serif text-white/95 leading-relaxed md:text-3xl whitespace-pre-wrap",
                todayDisplay.length > 100 ? "text-xl md:text-2xl" : "text-3xl md:text-4xl"
              )} dir="auto">
                {todayDisplay}
              </p>
              {todayTranslation && (
                <p className="text-base font-sans italic text-white/50 max-w-lg mx-auto leading-relaxed">
                  "{todayTranslation}"
                </p>
              )}
              
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent mx-auto pt-4" />

              <div className="flex flex-col items-center justify-center gap-3 text-sm text-white/40">
                <div className="flex items-center gap-2">
                   <Heart className="h-4 w-4 text-pink-400" />
                   <span>{t.currentOffering}: <span className="text-white/60 font-medium">{todayRaw?.offering || t.gratefulHeart}</span></span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 mt-6 border-t border-white/5 inline-block">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Add Offering Form */}
      <section className="mx-auto max-w-lg">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-8 md:p-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-medium">
              <Feather className="h-5 w-5 text-orange-400" />
              {t.addNewBlessing}
            </h2>
            <button
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-400 transition-all hover:bg-orange-500/20 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {t.aiGenerate}
            </button>
          </div>
          <form onSubmit={addOffering} className="space-y-4">
            <div className="space-y-2 relative">
              <label className="text-xs uppercase tracking-wider text-white/40">{t.blessingLabel}</label>
              <textarea 
                value={newBlessing}
                onChange={e => setNewBlessing(e.target.value)}
                placeholder={t.blessingPlaceholder}
                className="w-full h-48 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none transition-all focus:border-orange-500/50 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-white/40">{t.offeringLabel}</label>
              <input 
                type="text"
                value={newOffering}
                onChange={e => setNewOffering(e.target.value)}
                placeholder="e.g. Milk, Grains, Prayers..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none transition-all focus:border-orange-500/50"
              />
            </div>
            <button 
              type="submit"
              disabled={!newBlessing && !newOffering}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-400 py-4 font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
            >
              <Send className="h-4 w-4" />
              {t.submitOffering}
            </button>
          </form>
        </div>
      </section>

      {/* History */}
      <section className="space-y-6">
        <h2 className="flex items-center gap-2 text-xl font-medium px-4">
          <History className="h-5 w-5 text-white/40" />
          {t.pastOfferings}
        </h2>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {blessings.slice(1).map((b) => (
            <motion.div 
              key={b.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="shrink-0 w-[280px] rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-sm sm:w-full"
            >
              <p className="mb-4 text-sm italic text-white/70 line-clamp-6 leading-relaxed whitespace-pre-wrap">"{b.text}"</p>
              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <Heart className="h-3 w-3" />
                  {b.offering}
                </div>
                <span className="text-[10px] uppercase text-white/20">
                  {new Date(b.date).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))}
          {blessings.length <= 1 && (
            <p className="col-span-full py-12 text-center text-white/40 w-full">{t.noHistoryOfferings}</p>
          )}
        </div>

      </section>

      {/* Decorative Retail Shop Overlay */}
      <footer className="pt-20 text-center opacity-40">
        <p className="text-xs uppercase tracking-widest mb-2 font-light">Retail Prayer Shop</p>
        <div className="flex justify-center gap-4 text-sm">
          <span>Peace - $0.00</span>
          <span>•</span>
          <span>Strength - $0.00</span>
          <span>•</span>
          <span>Abundance - $0.00</span>
        </div>
      </footer>
    </div>
  );
};
