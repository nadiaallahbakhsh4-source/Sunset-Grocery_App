import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language?: string;
  placeholder?: string;
}

const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  ur: 'ur-PK',
  zh: 'zh-CN',
  es: 'es-ES',
  ar: 'ar-SA',
  hi: 'hi-IN',
};

const STATUS_TEXT: Record<string, Record<string, string>> = {
  en: {
    listening: 'Listening...',
    notSupported: 'Voice not supported',
    denied: 'Microphone permission denied',
    error: 'Speech ended',
  },
  ur: {
    listening: 'سن رہا ہے...',
    notSupported: 'آواز کی سہولت نہیں ہے',
    denied: 'مائیکروفون کی اجازت نہیں ہے',
    error: 'آواز بند ہو گئی',
  },
  zh: {
    listening: '正在聆听...',
    notSupported: '不支持语音输入',
    denied: '未获得麦克风权限',
    error: '语音结束',
  },
  es: {
    listening: 'Escuchando...',
    notSupported: 'Voz no soportada',
    denied: 'Permiso de micrófono denegado',
    error: 'La voz terminó',
  },
  ar: {
    listening: 'جاري الاستماع...',
    notSupported: 'الصوت غير مدعوم',
    denied: 'تم رفض إذن الميكروفون',
    error: 'انتهى الصوت',
  },
  hi: {
    listening: 'सुन रहा हूँ...',
    notSupported: 'आवाज समर्थित नहीं है',
    denied: 'माइक की अनुमति नहीं है',
    error: 'आवाज बंद हो गई',
  },
};

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  language = 'en',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const langCode = LANG_MAP[language] || 'en-US';
  const texts = STATUS_TEXT[language] || STATUS_TEXT.en;

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = langCode;

    rec.onstart = () => {
      setIsListening(true);
      setErrorMessage(null);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (resultText) {
        onTranscript(resultText);
      }
    };

    rec.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage(texts.denied);
      } else if (event.error === 'no-speech') {
        // Just end silently or show quick hint
      } else {
        setErrorMessage(texts.error);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [langCode, onTranscript, texts.denied, texts.error]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(texts.notSupported);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = langCode;
          recognitionRef.current.start();
        } catch (err) {
          console.error(err);
          // Retry re-instantiating if start crashed due to internal state
          try {
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = langCode;
            rec.onstart = () => {
              setIsListening(true);
              setErrorMessage(null);
            };
            rec.onresult = (evt: any) => {
              const resText = evt.results[0][0].transcript;
              if (resText) onTranscript(resText);
            };
            rec.onerror = (evt: any) => {
              if (evt.error === 'not-allowed') setErrorMessage(texts.denied);
              else setErrorMessage(texts.error);
              setIsListening(false);
            };
            rec.onend = () => setIsListening(false);
            recognitionRef.current = rec;
            rec.start();
          } catch (rErr) {
            setErrorMessage(texts.error);
          }
        }
      }
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            className="absolute right-12 flex items-center gap-1.5 bg-red-500/95 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-xl shadow-lg border border-red-400 whitespace-nowrap"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            {texts.listening}
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-12 flex items-center gap-1 bg-amber-500/95 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-amber-400 whitespace-nowrap"
            onAnimationComplete={() => {
              setTimeout(() => setErrorMessage(null), 4000);
            }}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-white" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        id="voice-input-btn"
        onClick={toggleListening}
        className={cn(
          "rounded-xl p-2 transition-all flex items-center justify-center relative cursor-pointer",
          isListening 
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105" 
            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
        )}
        title={isListening ? 'Stop capturing' : 'Talk hands-free'}
      >
        {isListening ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <MicOff className="h-4 w-4 text-white" />
          </motion.div>
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};
