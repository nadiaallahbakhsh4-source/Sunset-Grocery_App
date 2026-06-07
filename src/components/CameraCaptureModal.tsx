import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Check, Loader2, Sparkles, AlertCircle, RefreshCw, Upload, DollarSign, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { detectProductFromImage } from '../services/geminiService';
import { Item } from '../types';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: (item: Item) => void;
  categories: string[];
  units: string[];
  theme?: 'light' | 'dark';
  formatPrice: (amount: number) => string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onItemAdded,
  categories,
  units,
  theme = 'dark',
  formatPrice
}) => {
  const [step, setStep] = useState<'capture' | 'analyzing' | 'adjustSellPrice'>('capture');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // AI detected result properties
  const [detectedItem, setDetectedItem] = useState<{
    name: string;
    category: string;
    costPrice: number;
    unit: string;
    description: string;
  } | null>(null);

  // User input for selling price
  const [sellPrice, setSellPrice] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isLight = theme === 'light';

  // Toggle or scan devices
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset modal state
    setStep('capture');
    setErrorMsg(null);
    setCapturedImage(null);
    setDetectedItem(null);
    setSellPrice('');

    const getDevices = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = list.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          // Default to the outer/environment camera if available
          const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          setSelectedDeviceId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
        }
      } catch (err) {
        console.warn("Could not list video devices:", err);
      }
    };

    getDevices();
  }, [isOpen]);

  // Handle active stream setup
  useEffect(() => {
    if (!isOpen || step !== 'capture') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId, step]);

  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    
    const constraints: MediaStreamConstraints = {
      video: selectedDeviceId 
        ? { deviceId: { exact: selectedDeviceId } } 
        : { facingMode: 'environment' }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Direct webcam access failed (restricted or unavailable):", err);
      setErrorMsg("Camera access not allowed, or webcam not available. You can drag & drop or click to upload a photo instead!");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Flip or switch user camera
  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDeviceId(devices[nextIndex].deviceId);
  };

  // Capture frame
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current video frame into canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        stopCamera();
        processImage(dataUrl);
      }
    } catch (err) {
      console.error("Frame capture failed:", err);
      setErrorMsg("Unable to capture video frame.");
    }
  };

  // File Upload fallback selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedImage(dataUrl);
        stopCamera();
        processImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Call Gemini multimodal model
  const processImage = async (base64Img: string) => {
    setStep('analyzing');
    setErrorMsg(null);
    try {
      const result = await detectProductFromImage(base64Img, categories, units);
      setDetectedItem(result);
      // Give a neat formula-based default selling price (e.g. 15% margins)
      const calculatedSellPrice = Math.round(result.costPrice * 1.15);
      setSellPrice(calculatedSellPrice > 0 ? calculatedSellPrice.toString() : '');
      setStep('adjustSellPrice');
    } catch (err: any) {
      console.error("Gemini Image detection crashed:", err);
      setErrorMsg(err?.message || "AI failed to detect the product details. Please try another snapshot.");
      setStep('capture');
    }
  };

  // Finish and save newly created item with its prices
  const handleSaveProduct = () => {
    if (!detectedItem) return;

    const parsedSellPrice = Number(sellPrice) || 0;
    if (parsedSellPrice <= 0) {
      alert("Please provide a valid selling price greater than 0.");
      return;
    }

    // Prepare complete Item object
    const finalItem: Item = {
      id: crypto.randomUUID(),
      name: detectedItem.name,
      category: detectedItem.category,
      stock: 1, // Defaulting newly captured item with a baseline stock of 1
      costPrice: detectedItem.costPrice,
      sellPrice: parsedSellPrice,
      soldCount: 0,
      unit: detectedItem.unit,
      description: detectedItem.description || "Added via Gemini Camera Scan",
      isWeightBased: false,
      history: [{
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        field: 'stock',
        oldValue: 0,
        newValue: 1,
        description: 'Auto-registered via Camera Snapshot'
      }]
    };

    onItemAdded(finalItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop glass */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ scale: 0.92, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 15 }}
          className={cn(
            "relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl transition-all",
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-[#0b0604] border-orange-500/10 text-white"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-orange-500 animate-pulse" />
              <div>
                <h3 className="font-serif text-lg font-semibold">
                  {step === 'capture' && "Add via Camera Image"}
                  {step === 'analyzing' && "AI Multimodal Sensing"}
                  {step === 'adjustSellPrice' && "Add Item: Selling Price Setting"}
                </h3>
                <p className={cn(
                  "text-[9px] font-black uppercase tracking-widest block",
                  isLight ? "text-slate-400" : "text-white/30"
                )}>
                  Scan any stock item to auto-populate metadata & cost
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* STAGE 1: CAPTURE PHOTO OR UPLOAD */}
            {step === 'capture' && (
              <div className="space-y-4">
                {errorMsg && (
                  <div className="rounded-2xl bg-orange-500/5 border border-orange-500/10 p-4 text-xs text-orange-400 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-semibold">Webcam Not Available</p>
                      <p className="leading-relaxed opacity-85">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {/* Video feed viewport */}
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/70 border border-white/5 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Shutter Overlay Button */}
                  {streamRef.current && (
                    <div className="absolute inset-x-0 bottom-4 flex justify-center items-center gap-4">
                      {devices.length > 1 && (
                        <button
                          type="button"
                          onClick={handleSwitchCamera}
                          className="p-3.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 active:scale-90 transition-transform cursor-pointer"
                          title="Switch Camera Device"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        className="h-14 w-14 rounded-full bg-white hover:bg-orange-50 border-4 border-orange-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
                        title="Capture Photo"
                      >
                        <div className="h-6 w-6 rounded-full bg-orange-600"></div>
                      </button>

                      {/* Fake placeholder to balance layout */}
                      {devices.length > 1 && <div className="w-11"></div>}
                    </div>
                  )}

                  {/* Standard file dropzone fallback for iframe environment constraint safety */}
                  {!streamRef.current && (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center p-6 text-center cursor-pointer border-2 border-dashed border-white/10 hover:border-orange-500/30 transition-all rounded-2xl",
                        isLight ? "bg-slate-50 hover:bg-slate-100/50" : "bg-white/2 hover:bg-white/5"
                      )}
                    >
                      <Upload className="h-10 w-10 text-orange-500 mb-2.5 animate-bounce" />
                      <p className="text-sm font-semibold">Take Photo / Upload Image</p>
                      <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Supports drag & drop or clicking device storage</p>
                    </div>
                  )}
                </div>

                {/* File input handler */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                {/* Manual upload button always visible under camera frame */}
                {streamRef.current && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] font-mono tracking-widest uppercase text-white/40 hover:text-white flex items-center gap-1 cursor-pointer bg-white/2 hover:bg-white/5 rounded-xl px-3.5 py-2 border border-white/5 transition-all"
                    >
                      <Upload className="h-3 w-3" />
                      Or upload photo manually
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 2: AI RECOGNIZING */}
            {step === 'analyzing' && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="relative">
                  {capturedImage && (
                    <img
                      src={capturedImage}
                      alt="Analyzing snapshot"
                      className="w-28 h-28 object-cover rounded-2xl border-2 border-orange-500 shadow-xl opacity-60 filter blur-[0.5px]"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 justify-center text-sm font-bold text-orange-400 uppercase tracking-widest">
                    <Sparkles className="h-4 w-4 text-orange-500 animate-pulse" />
                    <span>Detecting Product...</span>
                  </div>
                  <p className={cn(
                    "text-xs leading-relaxed max-w-xs",
                    isLight ? "text-slate-500" : "text-white/50"
                  )}>
                    Gemini Multimodal Model is inspecting pixels to guess name, packaging, category and dealers buy price.
                  </p>
                </div>
              </div>
            )}

            {/* STAGE 3: PRICE DETAILS CONFIRMATION */}
            {step === 'adjustSellPrice' && detectedItem && (
              <div className="space-y-6">
                {/* Visual Header Summary of Detected Details */}
                <div className={cn(
                  "p-5 rounded-2xl border flex flex-col sm:flex-row gap-4 sm:items-center justify-between",
                  isLight ? "bg-slate-50 border-slate-200" : "bg-white/2 border-white/5"
                )}>
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-green-500 bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-md">
                        AI Detected
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-md">
                        {detectedItem.category}
                      </span>
                    </div>
                    <h4 className="font-serif text-lg font-bold tracking-tight">{detectedItem.name}</h4>
                    {detectedItem.description && (
                      <p className={cn(
                        "text-xs leading-relaxed",
                        isLight ? "text-slate-500" : "text-white/40 font-mono"
                      )}>
                        {detectedItem.description}
                      </p>
                    )}
                  </div>

                  {/* Cost Price Badge */}
                  <div className={cn(
                    "border rounded-xl p-3 text-center shrink-0 flex flex-col justify-center min-w-[110px]",
                    isLight ? "bg-slate-100 border-slate-200" : "bg-white/5 border-white/5"
                  )}>
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block mb-0.5">Est. Cost Price</span>
                    <span className="text-xl font-mono text-orange-400 font-bold">
                      {formatPrice(detectedItem.costPrice)}
                    </span>
                    <span className="text-[9px] font-mono text-white/20 mt-0.5">per {detectedItem.unit}</span>
                  </div>
                </div>

                {/* Asking user for selling price */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-orange-500 shrink-0 mt-0.5 animate-pulse" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-orange-400 uppercase tracking-widest">Provide Selling Price</p>
                      <p className={cn(
                        "leading-relaxed",
                        isLight ? "text-slate-700" : "text-white/70"
                      )}>
                        The item has been successfully identified with the buy price. To complete the setup, please provide the standard selling price for customers. We estimated a recommended price below.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block ml-1">
                      Customer Selling Price
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4.5">
                        <DollarSign className="h-5 w-5 text-orange-500" />
                      </div>
                      <input
                        type="number"
                        placeholder="Enter retail price for store checkout"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        className={cn(
                          "w-full rounded-2xl border px-12 py-4 outline-none transition-all text-sm font-semibold text-white",
                          isLight
                            ? "border-slate-200 bg-slate-50 text-slate-800 focus:border-orange-500"
                            : "border-white/10 bg-white/5 focus:border-orange-500/50"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Foot Action Buttons */}
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('capture')}
                    className={cn(
                      "px-5 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer border active:scale-95",
                      isLight
                        ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "bg-white/2 border-white/5 text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    Retake Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProduct}
                    disabled={!sellPrice.trim() || Number(sellPrice) <= 0}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirm & Save</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
