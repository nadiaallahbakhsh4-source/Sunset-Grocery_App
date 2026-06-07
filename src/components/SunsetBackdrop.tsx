import React from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const data = [
  { name: 'Jan', profit: 400, loss: 240 },
  { name: 'Feb', profit: 300, loss: 139 },
  { name: 'Mar', profit: 200, loss: 980 },
  { name: 'Apr', profit: 278, loss: 390 },
  { name: 'May', profit: 189, loss: 480 },
  { name: 'Jun', profit: 239, loss: 380 },
  { name: 'Jul', profit: 349, loss: 430 },
];

interface SunsetBackdropProps {
  isLight?: boolean;
}

export const SunsetBackdrop: React.FC<SunsetBackdropProps> = ({ isLight = false }) => {
  return (
    <div className={cn(
      "fixed inset-0 z-[-1] overflow-hidden transition-colors duration-1000",
      isLight ? "bg-orange-50" : "bg-[#0a0502]"
    )}>
      {/* Atmosphere - Layered Gradients */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          isLight ? "opacity-30" : "opacity-60"
        )}
        style={{
          background: isLight 
            ? `
              radial-gradient(circle at 50% 100%, #ffcf8a 0%, transparent 70%),
              radial-gradient(circle at 10% 20%, #e0f2fe 0%, transparent 50%),
              radial-gradient(circle at 90% 30%, #fff7ed 0%, transparent 50%)
            `
            : `
              radial-gradient(circle at 50% 100%, #ff8c00 0%, transparent 60%),
              radial-gradient(circle at 10% 20%, #4b0082 0%, transparent 50%),
              radial-gradient(circle at 90% 30%, #8b0000 0%, transparent 50%),
              #1a0b00
            `
        }}
      />
      
      {/* Decorative Sun */}
      <div className={cn(
        "absolute transition-all duration-1000 rounded-full blur-[80px]",
        isLight 
          ? "top-[-100px] left-[10%] h-[400px] w-[400px] bg-yellow-400 opacity-20"
          : "bottom-[-100px] left-1/2 h-[500px] w-[500px] -translate-x-1/2 bg-gradient-to-t from-[#ff4e00] to-transparent opacity-100"
      )} />

      {/* Abstract Profit/Loss Visualization in the Backdrop */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-[40vh] transition-opacity duration-1000",
        isLight ? "opacity-10" : "opacity-20"
      )}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isLight ? "#f59e0b" : "#ffd700"} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={isLight ? "#f59e0b" : "#ffd700"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="profit" 
              stroke={isLight ? "#f59e0b" : "#ffd700"} 
              fillOpacity={1} 
              fill="url(#colorProfit)" 
              strokeWidth={4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Moving atmospheric particles */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: isLight ? [0.02, 0.05, 0.02] : [0.1, 0.3, 0.1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"
      />
    </div>
  );
};
