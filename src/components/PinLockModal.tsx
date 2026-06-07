import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Delete, Lock, Key, RefreshCw, LogIn, Eye, EyeOff, Check, ChevronLeft, HelpCircle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface PinLockModalProps {
  storedPin?: string;
  onSetPin: (pin: string) => Promise<void>;
  onUnlock: () => void;
  onLogout: () => Promise<void>;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  storedPin,
  onSetPin,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>(storedPin ? 'create' : 'create');
  const [tempPin, setTempPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [shakeCode, setShakeCode] = useState<number>(0);
  const [showPin, setShowPin] = useState<boolean>(false);

  // States for the resetting flow
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const isSetup = !storedPin;
  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

  // Keypad button click handler
  const handleNumberClick = (num: string) => {
    if (pin.length >= 4) return;
    setError(null);
    setPin(prev => prev + num);
  };

  const handleBackspace = () => {
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  // Keyboard support with accessibility attributes
  useEffect(() => {
    if (isResetting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;
      if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isProcessing, setupStep, tempPin, storedPin, isResetting]);

  // Process PIN when complete (4 digits)
  useEffect(() => {
    if (pin.length !== 4 || isResetting) return;

    const processPin = async () => {
      setIsProcessing(true);
      setError(null);

      if (isSetup) {
        if (setupStep === 'create') {
          // Store first entry of setup and request confirmation
          setTempPin(pin);
          setPin('');
          setSetupStep('confirm');
          setIsProcessing(false);
        } else {
          // Confirm step
          if (pin === tempPin) {
            try {
              await onSetPin(pin);
              onUnlock();
            } catch (err: any) {
              setError("Failed to save PIN code. Try again.");
              setPin('');
              setTempPin('');
              setSetupStep('create');
            }
          } else {
            setError("PINs do not match. Restarting setup.");
            setPin('');
            setTempPin('');
            setSetupStep('create');
            setShakeCode(prev => prev + 1);
          }
          setIsProcessing(false);
        }
      } else {
        // Verification step
        if (pin === storedPin) {
          onUnlock();
        } else {
          setError("Incorrect PIN. Please try again.");
          setPin('');
          setShakeCode(prev => prev + 1);
        }
        setIsProcessing(false);
      }
    };

    const timer = setTimeout(processPin, 200);
    return () => clearTimeout(timer);
  }, [pin, isResetting]);

  // Handle credentials verification and reset trigger
  const handleResetPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setResetError(null);
    setResetLoading(true);

    try {
      if (isGoogleUser) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
      } else {
        if (!resetPassword) {
          throw new Error("Password is required to reset PIN.");
        }
        await signInWithEmailAndPassword(auth, auth.currentUser.email!, resetPassword);
      }

      // Re-authentication succeeded, reset existing PIN code
      await onSetPin(''); // clear PIN database
      setPin('');
      setTempPin('');
      setSetupStep('create');
      setIsResetting(false);
      setResetPassword('');
      alert("Verification successful! Please create your new 4-digit PIN.");
    } catch (err: any) {
      console.error("PIN Reset Verification Error:", err);
      setResetError(err.message || "Credential verification failed. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#060301] p-3 sm:p-4 font-sans select-none overflow-y-auto">
      {/* Immersive animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[80vw] h-[80vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-tr from-orange-600/10 via-rose-600/5 to-transparent blur-[120px] animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[10%] right-[15%] w-[80vw] h-[80vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-bl from-amber-600/10 via-yellow-600/5 to-transparent blur-[120px] animate-pulse duration-[6000ms]" />
      </div>

      <div className="w-full max-w-[320px] sm:max-w-[360px] bg-[#130b05]/90 border border-white/10 backdrop-blur-3xl rounded-3xl p-4 sm:p-6 flex flex-col items-center relative z-10 shadow-2xl shadow-orange-950/25">
        {isResetting ? (
          /* Authentication PIN Reset Flow Form */
          <div className="w-full flex flex-col items-center space-y-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/10 rounded-xl flex items-center justify-center ring-4 ring-orange-500/5 text-orange-400"
            >
              <Key className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </motion.div>

            <div className="text-center space-y-1">
              <h2 className="text-lg sm:text-xl font-serif text-white tracking-tight">Security Verifier</h2>
              <p className="text-white/50 text-[11px] leading-relaxed max-w-xs mx-auto">
                Verify profile ownership with account credentials to release your security lock code.
              </p>
            </div>

            <form onSubmit={handleResetPIN} className="w-full space-y-3">
              <div className="space-y-1 bg-white/5 border border-white/10 rounded-xl p-3">
                <label className="text-[9px] font-bold uppercase tracking-widest text-[#f97316]/80 block">Registered Email</label>
                <div className="w-full text-white/90 text-xs font-medium select-all break-all leading-tight">
                  {auth.currentUser?.email || "No Email Associated"}
                </div>
              </div>

              {!isGoogleUser ? (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">Account Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter account password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500/50 hover:bg-white/8 text-xs transition-all font-sans"
                  />
                </div>
              ) : (
                <div className="p-3 bg-orange-500/15 border border-orange-500/20 rounded-xl text-center">
                  <p className="text-orange-400 text-[11px] font-semibold leading-relaxed">
                    Account connected with Google. Confirm below to safely reset PIN.
                  </p>
                </div>
              )}

              {resetError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 flex items-start gap-1.5">
                  <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-[11px] font-medium leading-normal">
                    {resetError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-[#0c0602] rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-orange-500/10 active:scale-[0.98]"
              >
                {resetLoading ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={12} className="stroke-[2.5]" />
                    <span>{isGoogleUser ? "Verify with Google" : "Verify & Reset"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsResetting(false);
                  setResetError(null);
                  setResetPassword('');
                }}
                className="w-full py-2 bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <ChevronLeft size={12} />
                <span>Return To Lockpad</span>
              </button>
            </form>
          </div>
        ) : (
          /* Standard Pad / Setup Screen Form */
          <>
            {/* Elegant Brand Logo Subtitle */}
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f97316] mb-1 sm:mb-1.5 animate-pulse text-center select-none">
              Sunset Grocery & Blessings
            </div>

            {/* Header Lock Icon adorned with an elegant sunset layout ring */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-9 h-9 sm:w-11 sm:h-11 relative flex items-center justify-center mb-2 sm:mb-2.5"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-xl opacity-10 animate-pulse duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-xl p-[1px] opacity-40">
                <div className="w-full h-full bg-[#130b05] rounded-xl" />
              </div>
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 z-10" />
            </motion.div>

            {/* setup progress visual checklist */}
            {isSetup && (
              <div className="w-full max-w-[160px] flex items-center justify-around mb-2.5 sm:mb-3 relative">
                <div className="absolute left-[25%] right-[25%] top-[8px] h-[1.5px] bg-white/10 z-0" />
                <div className="absolute left-[25%] right-[25%] top-[8px] h-[1.5px] bg-gradient-to-r from-orange-500 to-transparent z-0 transition-all duration-300" style={{ width: setupStep === 'confirm' ? '50%' : '0%' }} />

                <div className="flex flex-col items-center gap-0.5 z-10">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black border transition-all ${
                    setupStep === 'create' 
                      ? 'bg-orange-500 border-orange-500 text-[#130b05] ring-2 ring-orange-500/20' 
                      : 'bg-orange-950/80 border-orange-500/30 text-orange-400'
                  }`}>
                    {setupStep === 'confirm' ? <Check size={7} className="stroke-[3]" /> : "1"}
                  </div>
                  <span className="text-[7px] font-bold uppercase tracking-wider text-white/50">Create</span>
                </div>

                <div className="flex flex-col items-center gap-0.5 z-10">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black border transition-all ${
                    setupStep === 'confirm' 
                      ? 'bg-orange-500 border-orange-500 text-[#130b05] ring-2 ring-orange-500/20' 
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}>
                    2
                  </div>
                  <span className="text-[7px] font-bold uppercase tracking-wider text-white/50">Confirm</span>
                </div>
              </div>
            )}

            {/* Dynamic Titles */}
            <div className="text-center mb-2 sm:mb-2.5 space-y-0.5">
              <h2 className="text-base sm:text-lg font-serif text-white tracking-tight leading-tight">
                {isSetup 
                  ? (setupStep === 'create' ? "Establish Security PIN" : "Confirm Security PIN")
                  : "Security Key Required"
                }
              </h2>
              <p className="text-white/45 text-[9px] sm:text-[10px] tracking-normal max-w-[220px] sm:max-w-xs mx-auto leading-normal">
                {isSetup
                  ? (setupStep === 'create' 
                      ? "Create a unique 4-digit security PIN to restrict administrative settings." 
                      : "Please type the security PIN again to verify configuration.")
                  : "Authentication locked. Type your 4-digit system PIN."
                }
              </p>
            </div>

            {/* Digit Indicators with dynamic scaling & tactile feedback and a small reveal status */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <motion.div 
                key={shakeCode}
                animate={shakeCode > 0 ? { x: [0, -10, 10, -10, 10, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex justify-center gap-3"
              >
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = pin.length > index;
                  const currentDigit = isFilled ? pin[index] : '';
                  return (
                    <div 
                      key={index}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center transition-all duration-300 font-sans text-xs sm:text-sm font-black ${
                        isFilled 
                          ? 'border-[#f97316] bg-[#f97316]/5 text-[#f97316] scale-105 shadow-md shadow-orange-500/5' 
                          : 'border-white/10 bg-white/2 text-transparent'
                      }`}
                    >
                      {isFilled ? (showPin ? currentDigit : '●') : ''}
                    </div>
                  );
                })}
              </motion.div>

              {/* Accessible Show Pin Selector Eye Toggle */}
              {pin.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="flex items-center gap-1 text-white/45 hover:text-white/80 transition-all text-[9px] uppercase font-bold tracking-widest hover:bg-white/5 py-0.5 px-2 rounded-lg border border-white/5 active:scale-95"
                  aria-label={showPin ? "Hide Pin Code Numbers" : "Show Pin Code Numbers"}
                >
                  {showPin ? <EyeOff size={10} className="text-orange-400" /> : <Eye size={10} />}
                  <span>{showPin ? "Mask" : "Reveal"}</span>
                </button>
              )}
            </div>

            {/* Error message slot with rigid animation bounds */}
            <div className="h-5 mb-2 flex items-center justify-center">
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-red-400 text-[10px] font-semibold flex items-center gap-1 bg-red-500/10 border border-red-500/20 py-0.5 px-2.5 rounded-full shadow-inner"
                  >
                    <ShieldAlert size={10} className="shrink-0 text-red-400" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Modern Keypad Matrix Grid designed for multi-factor security locks */}
            <div className="grid grid-cols-3 gap-y-2 gap-x-4 w-full max-w-[210px] sm:max-w-[240px] mb-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <motion.button
                  key={num}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleNumberClick(num)}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(249, 115, 22, 0.3)' }}
                  whileTap={{ scale: 0.94 }}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/5 border border-white/5 text-lg font-bold text-white flex items-center justify-center transition-all duration-150 disabled:opacity-50 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  aria-label={`Digit ${num}`}
                >
                  {num}
                </motion.button>
              ))}
              
              {/* Action Left: Clear */}
              <motion.button
                type="button"
                disabled={isProcessing || !pin}
                onClick={handleClear}
                whileTap={{ scale: 0.94 }}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl text-[9px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60 flex items-center justify-center transition-all select-none cursor-pointer disabled:opacity-20"
                aria-label="Clear all entered digits"
              >
                Clear
              </motion.button>

              {/* Digit zero */}
              <motion.button
                key="0"
                type="button"
                disabled={isProcessing}
                onClick={() => handleNumberClick('0')}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(249, 115, 22, 0.3)' }}
                whileTap={{ scale: 0.94 }}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/5 border border-white/5 text-lg font-bold text-white flex items-center justify-center transition-all duration-150 disabled:opacity-50 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                aria-label="Digit 0"
              >
                0
              </motion.button>

              {/* Action Right: Backspace */}
              <motion.button
                type="button"
                disabled={isProcessing || !pin}
                onClick={handleBackspace}
                whileTap={{ scale: 0.94 }}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl text-white/40 hover:text-white flex items-center justify-center transition-all select-none cursor-pointer disabled:opacity-20"
                aria-label="Backspace delete previous digit"
              >
                <Delete size={16} className="stroke-[1.8]" />
              </motion.button>
            </div>

            {/* Forgot PIN Recovery Trigger Option */}
            {!isSetup && (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetting(true);
                    setResetError(null);
                    setResetPassword('');
                  }}
                  className="text-orange-500/60 hover:text-orange-500 transition-all font-bold uppercase text-[9px] tracking-widest underline decoration-dotted underline-offset-4 cursor-pointer flex items-center gap-1"
                >
                  <HelpCircle size={10} className="text-orange-500/50" />
                  <span>Reset PIN via login</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Signout Fallback Option */}
        <button
          onClick={onLogout}
          className="text-orange-500/40 hover:text-orange-500/80 transition-all font-bold uppercase text-[9px] tracking-[0.2em] pt-3 mt-1.5 border-t border-white/5 w-full text-center cursor-pointer flex items-center justify-center gap-1"
        >
          <span>Exit Profile</span>
        </button>
      </div>
    </div>
  );
};

