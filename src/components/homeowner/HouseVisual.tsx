import { useEffect, useState } from "react";

/** Stable public URL so index.html can preload the LCP image. */
const HERO_SRC = "/solar-home-hero.jpg";

interface HouseVisualProps {
  stage: number;
}

export function HouseVisual({ stage }: HouseVisualProps) {
  const [localStage, setLocalStage] = useState(stage);

  useEffect(() => {
    setLocalStage(stage);
  }, [stage]);

  return (
    <div className="relative h-full w-full">
      {/* Container with blending mask to integrate into the navy background */}
      <div className="relative h-full w-full house-blend-mask overflow-hidden lg:rounded-l-[60px] lg:rounded-bl-[120px]">
        {/* Photorealistic Background — visible immediately for LCP (no opacity delay) */}
        <div
          className="h-full w-full transition-transform duration-2000 ease-out"
          style={{
            transform: localStage >= 1 ? "scale(1)" : "scale(1.05)",
          }}
        >
          <img
            src={HERO_SRC}
            alt="Photorealistic U.S. home with solar panels"
            width={1200}
            height={900}
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-cover object-[center_35%]"
          />
          
          {/* Natural daytime lighting atmosphere */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-orange-400/10 mix-blend-soft-light" />
        </div>

        {/* STAGE 1: Sun brightness increase */}
        <div className="absolute top-8 right-8 z-20 pointer-events-none">
          {/* Realistic Sun */}
          <div 
            className="w-16 h-16 rounded-full bg-white transition-all duration-2000"
            style={{ 
              boxShadow: stage >= 1 
                ? "0 0 60px 20px white, 0 0 100px 40px oklch(0.85 0.15 70 / 0.6)" 
                : "0 0 20px 5px white",
              opacity: localStage >= 1 ? 1 : 0
            }}
          />
        </div>

        {/* STAGE 2: Sunlight rays travelling to panels */}
        {localStage >= 2 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Sunlight rays */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute h-[200%] w-[2px] bg-gradient-to-b from-white/80 via-sun-warm/20 to-transparent blur-[1px]"
                style={{
                  right: `${15 + i * 10}%`,
                  top: "-50%",
                  transformOrigin: "top right",
                  rotate: "35deg",
                  transition: "opacity 1.5s ease-out, transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  opacity: localStage >= 2 ? (localStage >= 4 ? 0 : 0.4) : 0,
                  transform: localStage >= 2 ? "translateY(50%)" : "translateY(-100%)",
                  transitionDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
        )}

        {/* STAGE 3: Reflection sweep & Panel brightening */}
        {localStage >= 3 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {/* Reflection sweep */}
            <div 
              className="absolute top-[35%] left-[45%] w-[30%] h-[20%] rotate-[-12deg] overflow-hidden"
              style={{ opacity: localStage >= 3 ? 1 : 0 }}
            >
              <div className="panel-glint w-full h-full" />
            </div>
            
            {/* Subtle brightening */}
            <div
              className="absolute top-[35%] left-[45%] w-[30%] h-[20%] rotate-[-12deg] bg-white/20 mix-blend-overlay rounded-sm transition-opacity duration-1000"
              style={{ opacity: localStage >= 3 ? 1 : 0 }}
            />
          </div>
        )}

        {/* STAGE 4: AI Scan */}
        {localStage >= 4 && (
          <svg
            viewBox="0 0 800 600"
            className="absolute inset-0 h-full w-full pointer-events-none z-30"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* AI Roof Outline */}
            <path
              d="M360 230 L540 215 L630 340 L270 365 Z"
              fill="oklch(0.75 0.18 190 / 0.05)"
              stroke="oklch(0.75 0.18 190)"
              strokeWidth="2"
              strokeDasharray="1000"
              strokeDashoffset={localStage >= 4 ? 0 : 1000}
              className="transition-all duration-1500 ease-in-out"
              style={{ opacity: 0.6 }}
            />
            
            {/* Scan Line */}
            <line 
              x1="270" y1="210" x2="630" y2="210"
              stroke="oklch(0.75 0.18 190)"
              strokeWidth="3"
              className="search-highlight-pulse"
              style={{
                opacity: localStage >= 4 ? 0.8 : 0,
                transform: localStage >= 4 ? "translateY(150px)" : "translateY(0)",
                transition: "transform 2s ease-in-out"
              }}
            />
          </svg>
        )}
      </div>

      {/* Atmospheric Haze / Depth Overlays (Outside mask for smoother transition) */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-navy-dark via-navy-dark/40 to-transparent w-1/3 z-10" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-navy-dark to-transparent z-10" />
    </div>
  );
}
