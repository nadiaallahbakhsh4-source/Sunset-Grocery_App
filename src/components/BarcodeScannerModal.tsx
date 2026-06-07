import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Check, Keyboard, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { cn } from '../lib/utils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  theme?: 'light' | 'dark';
  title?: string;
  placeholder?: string;
}

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.warn("Audio Context beep failed:", e);
  }
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  theme = 'dark',
  title = 'Scan Barcode / QR Code',
  placeholder = 'Or enter barcode manually...'
}) => {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const COMPONENT_ID = "sunset-barcode-scanner-rendering-target";

  // Handle barcode/QR code detection
  const handleSuccessResult = async (decodedText: string) => {
    playBeep();
    // Stop scanner first
    if (scannerRef.current && scannerRef.current.isScanning) {
      setIsStopping(true);
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Scanner stop failed on success:", e);
      }
    }
    onScan(decodedText);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playBeep();
      onScan(manualCode.trim());
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setManualCode('');
    setIsManualMode(false);
    setIsTorchOn(false);
    setIsStopping(false);

    let activeScanner: Html5Qrcode | null = null;

    // Timeout slightly to ensure modal is rendered and ID element is present in the DOM
    const timer = setTimeout(() => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setHasCameraPermission(false);
          setErrorMessage("Camera access is restricted or unsupported in this browser environment. Please enter code manually.");
          setIsManualMode(true);
          return;
        }

        activeScanner = new Html5Qrcode(COMPONENT_ID);
        scannerRef.current = activeScanner;

        // Determine Scan Box size - wider for shelf barcodes
        const scanBoxConfig = (width: number, height: number) => {
          const size = Math.min(width, height);
          return {
            width: Math.floor(size * 0.8),
            height: Math.floor(size * 0.5)
          };
        };

        activeScanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: scanBoxConfig,
            aspectRatio: 1.0,
          },
          (text) => {
            handleSuccessResult(text);
          },
          (err) => {
            // Keep scanning, silent errors for failed frame read
          }
        ).then(() => {
          setHasCameraPermission(true);
        }).catch((err) => {
          console.warn("Camera start failed gracefully:", err);
          setHasCameraPermission(false);
          setErrorMessage("Failed to start direct camera (permission denied or restricted within iFrame sandbox). Please use manual entry.");
          setIsManualMode(true);
        });
      } catch (err: any) {
        console.warn("Scanner initialization or permission rejected:", err);
        setHasCameraPermission(false);
        setErrorMessage("Camera service could not initialize. Please enter the barcode code manually.");
        setIsManualMode(true);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      const cleanUp = async () => {
        if (activeScanner && activeScanner.isScanning) {
          try {
            await activeScanner.stop();
          } catch (e) {
            console.warn("Scanner stopped uncleanly on unmount:", e);
          }
        }
      };
      cleanUp();
    };
  }, [isOpen]);

  // Handle Torch Toggling
  const handleToggleTorch = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        const nextTorch = !isTorchOn;
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: nextTorch } as any]
        });
        setIsTorchOn(nextTorch);
      } catch (err) {
        console.warn("Torch/Flashlight not supported on this device/browser.", err);
      }
    }
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={async () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
              await scannerRef.current.stop().catch(() => {});
            }
            onClose();
          }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className={cn(
            "relative w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl transition-all",
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-[#0b0604] border-orange-500/10 text-white"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-orange-500" />
              <h3 className="font-serif text-lg font-medium">{title}</h3>
            </div>
            <button
              onClick={async () => {
                if (scannerRef.current && scannerRef.current.isScanning) {
                  await scannerRef.current.stop().catch(() => {});
                }
                onClose();
              }}
              className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Direct Camera Scan Mode */}
            <div className={cn(
              "relative aspect-square w-full rounded-2xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center",
              isManualMode ? "hidden" : "block"
            )}>
              {/* Dynamic Live Scanner Video Frame */}
              <div id={COMPONENT_ID} className="w-full h-full [&_video]:object-cover" />

              {/* Laser Line Scanning Indicator */}
              {hasCameraPermission && !isStopping && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[80%] h-[50%] border-2 border-orange-500/80 rounded-xl relative shadow-[0_0_15px_rgba(249,115,22,0.3)] bg-orange-500/5">
                    {/* Pulsing overlay glowing targets */}
                    <span className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-orange-500 rounded-tl-md"></span>
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-orange-500 rounded-tr-md"></span>
                    <span className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-orange-500 rounded-bl-md"></span>
                    <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-orange-500 rounded-br-md"></span>

                    {/* Red/Orange vertical sweep line laser */}
                    <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_8px_#f97316] animate-pulse top-4" style={{
                      animation: 'scan-laser 2s ease-in-out infinite',
                      position: 'absolute'
                    }}></div>
                  </div>
                </div>
              )}

              {/* Flashlight/Torch Toggle Button Overlay */}
              {hasCameraPermission && !isStopping && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={cn(
                    "absolute bottom-4 right-4 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer backdrop-blur-md transition-all active:scale-95 border",
                    isTorchOn 
                      ? "bg-orange-500 text-white border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]" 
                      : "bg-black/40 text-white border-white/10 hover:bg-black/60"
                  )}
                >
                  🔦 {isTorchOn ? "Flash Off" : "Flash On"}
                </button>
              )}

              {/* Permission Checking or Spinner state */}
              {hasCameraPermission === null && (
                <div className="absolute inset-0 bg-[#0b0604] flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">Requesting Camera...</span>
                </div>
              )}

              {/* Scanning status/beeps */}
              {isStopping && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-green-500">Code Captured!</span>
                </div>
              )}
            </div>

            {/* Manual Form Area */}
            {isManualMode && (
              <form onSubmit={handleManualSubmit} className="space-y-4 py-4">
                {errorMessage && (
                  <div className="rounded-2xl bg-orange-500/5 text-orange-400 p-4 border border-orange-500/10 flex items-start gap-2.5 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-orange-500" />
                    <p className="leading-relaxed font-medium">{errorMessage}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Barcode String</label>
                  <input
                    type="text"
                    autoFocus
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter numbers or string (e.g. 7410010041)"
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3.5 outline-none transition-all text-sm",
                      isLight
                        ? "border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:border-orange-500"
                        : "border-white/10 bg-white/5 focus:bg-white/10 text-white focus:border-orange-500/50"
                    )}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-45 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  <span>Submit Code</span>
                </button>
              </form>
            )}

            {/* Toggle Modes Button Footer */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (!isManualMode && scannerRef.current && scannerRef.current.isScanning) {
                    await scannerRef.current.stop().catch(() => {});
                  }
                  setIsManualMode(!isManualMode);
                }}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer py-2 px-3 rounded-xl transition-all",
                  isLight 
                    ? "hover:bg-slate-100 text-slate-600" 
                    : "hover:bg-white/5 text-white/60 hover:text-white"
                )}
              >
                {isManualMode ? (
                  <>
                    <Camera className="h-4 w-4 text-orange-500" />
                    <span>Switch to Camera</span>
                  </>
                ) : (
                  <>
                    <Keyboard className="h-4 w-4 text-orange-500" />
                    <span>Enter Manually</span>
                  </>
                )}
              </button>

              {!isManualMode && hasCameraPermission && (
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-white/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Camera Live
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Embedded CSS for running the scanner visual laser animate sweep */}
      <style>{`
        @keyframes scan-laser {
          0% {
            top: 4%;
            opacity: 0.2;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 96%;
            opacity: 0.2;
          }
        }
      `}</style>
    </AnimatePresence>
  );
};
