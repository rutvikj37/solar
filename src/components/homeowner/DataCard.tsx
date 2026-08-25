import { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface DataCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  subValue?: string;
  status: "idle" | "analyzing" | "complete";
  delay?: number;
  highlighted?: boolean;
  trend?: "up" | "down";
}

export function DataCard({ icon: Icon, label, value, unit, subValue, status, highlighted, trend }: DataCardProps) {
  return (
    <div
      className={`glass-card flex w-[120px] sm:w-44 flex-col gap-0.5 sm:gap-1.5 p-2 sm:p-3 sm:px-4 ${
        highlighted ? "savings-card-glow border-cyan-500/30 sm:scale-105" : "shadow-[0_0_20px_oklch(0.75_0.18_190_/_0.1)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-cyan-400" />
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/40 whitespace-nowrap">
            AI Analysis
          </span>
        </div>
        {status === "analyzing" && (
          <div className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_oklch(0.75_0.18_190)] animate-pulse" />
        )}
      </div>

      <div className="mt-0.5 sm:mt-1">
        <p className="text-[7px] sm:text-[9px] font-bold uppercase tracking-wider text-white/50">{label}</p>
        <div className="mt-0 h-6 sm:h-7 flex items-baseline">
          {status === "analyzing" ? (
            <p className="text-[10px] sm:text-xs font-bold text-cyan-400 italic animate-pulse">
              Analyzing...
            </p>
          ) : status === "complete" ? (
            <div className="flex flex-col gap-0">
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                {trend === "up" && (
                  <span className="text-cyan-400 text-[8px] sm:text-[10px] mb-0.5 animate-bounce">↑</span>
                )}
                <span className={`font-extrabold text-white tracking-tight ${highlighted ? "text-sm sm:text-2xl" : "text-xs sm:text-lg"}`}>
                  {value}
                </span>
                {unit && (
                  <span className="text-[7px] sm:text-[10px] font-bold text-white/40 uppercase">
                    {unit}
                  </span>
                )}
              </div>
              {subValue && (
                <p className="text-[7px] sm:text-[9px] font-medium text-cyan-400/80 mt-[-2px] leading-tight">
                  {subValue}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {status === "complete" && (
        <div 
          className="h-[1px] bg-gradient-to-r from-cyan-500/50 via-cyan-400 to-transparent transition-all duration-1000"
          style={{ width: "100%" }}
        />
      )}
    </div>
  );
}
