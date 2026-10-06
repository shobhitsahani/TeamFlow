'use client';

import { Sun, Moon } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/components/theme-provider';

interface Particle {
  id: number;
  delay: number;
  duration: number;
}

/**
 * Cinematic theme switcher — pill toggle with spring thumb + particle burst.
 *
 * Adapted to this repo's own ThemeProvider (`tf.theme.v2`, dark-first):
 * uses `useTheme` from `@/components/theme-provider` instead of
 * `next-themes`, so there is exactly one theme store. Drop-in anywhere a
 * `ThemeToggle` is used, e.g. the board header or the app-shell topbar.
 *
 * `size="sm"` renders a true header-scale variant (64x36 track, 24px
 * thumb) with the same visuals. `size="md"` is the full 104x64 original.
 */
export function CinematicThemeSwitcher({ size = "md" }: { size?: "sm" | "md" }) {
  // Header-scale dimensions (sm) vs full-size original (md). Track travel =
  // inner width minus thumb so the thumb docks at both ends.
  const dims =
    size === "sm"
      ? { trackW: 64, trackH: 36, pad: 4, thumb: 24, travel: 28, icon: 12, bgPad: 10 }
      : { trackW: 104, trackH: 64, pad: 6, thumb: 44, travel: 46, icon: 20, bgPad: 16 };
  const { theme, setTheme } = useTheme();

  // State Management
  // Mounted gate without an effect: ThemeProvider already syncs theme via a
  // lazy initializer (dark-first, matching the pre-paint layout script), so
  // the switch renders enabled on first paint. Same pattern as ThemeToggle.
  const [mounted] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Ref to track toggle button DOM element
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Track whether toggle is in checked (dark) or unchecked (light) position.
  // Local theme is always 'light' | 'dark' (dark-first default), so no
  // resolvedTheme fallback is needed.
  const isDark = mounted && theme === 'dark';

  // Generate particles with different timing
  const generateParticles = () => {
    const newParticles: Particle[] = [];
    const particleCount = 3; // Multiple layers

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        delay: i * 0.1, // Stagger timing
        duration: 0.6 + i * 0.1, // Different durations for depth
      });
    }

    setParticles(newParticles);
    setIsAnimating(true);

    // Clear particles after animation
    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);
  };

  // Toggle handler - switches theme and triggers particles
  const handleToggle = () => {
    generateParticles();
    setTheme(isDark ? 'light' : 'dark');
  };

  // Prevent hydration mismatch - show placeholder during SSR (sized to match).
  if (!mounted) {
    return (
      <div className="relative inline-block">
        <div
          className="relative flex items-center rounded-full bg-gray-200 p-1"
          style={{ width: dims.trackW, height: dims.trackH }}
        />
      </div>
    );
  }

  return (
    <div className="relative inline-block shrink-0">
      {/* SVG Filter for Film Grain Texture */}
      <svg className="absolute w-0 h-0">
        <defs>
          {/* Light mode grain - subtle */}
          <filter id="grain-light">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="4"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="saturate"
              values="0"
              result="desaturatedNoise"
            />
            <feComponentTransfer in="desaturatedNoise" result="lightGrain">
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="lightGrain" mode="overlay" />
          </filter>

          {/* Dark mode grain - more visible */}
          <filter id="grain-dark">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="4"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="saturate"
              values="0"
              result="desaturatedNoise"
            />
            <feComponentTransfer in="desaturatedNoise" result="darkGrain">
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="darkGrain" mode="overlay" />
          </filter>
        </defs>
      </svg>

      {/* Pill-shaped track container */}
      <motion.button
        ref={toggleRef}
        onClick={handleToggle}
        className="relative flex items-center rounded-full transition-all duration-300 focus:outline-none"
        style={{
          width: dims.trackW,
          height: dims.trackH,
          padding: dims.pad,
          background: isDark
            ? 'radial-gradient(ellipse at top left, #1e293b 0%, #0f172a 40%, #020617 100%)'
            : 'radial-gradient(ellipse at top left, #ffffff 0%, #f1f5f9 40%, #cbd5e1 100%)',
          boxShadow: isDark
            ? `
              inset 5px 5px 12px rgba(0, 0, 0, 0.9),
              inset -5px -5px 12px rgba(71, 85, 105, 0.4),
              inset 8px 8px 16px rgba(0, 0, 0, 0.7),
              inset -8px -8px 16px rgba(100, 116, 139, 0.2),
              inset 0 2px 4px rgba(0, 0, 0, 1),
              inset 0 -2px 4px rgba(71, 85, 105, 0.4),
              inset 0 0 20px rgba(0, 0, 0, 0.6),
              0 1px 1px rgba(255, 255, 255, 0.05),
              0 2px 4px rgba(0, 0, 0, 0.4),
              0 8px 16px rgba(0, 0, 0, 0.4),
              0 16px 32px rgba(0, 0, 0, 0.3),
              0 24px 48px rgba(0, 0, 0, 0.2)
            `
            : `
              inset 5px 5px 12px rgba(148, 163, 184, 0.5),
              inset -5px -5px 12px rgba(255, 255, 255, 1),
              inset 8px 8px 16px rgba(100, 116, 139, 0.3),
              inset -8px -8px 16px rgba(255, 255, 255, 0.9),
              inset 0 2px 4px rgba(148, 163, 184, 0.4),
              inset 0 -2px 4px rgba(255, 255, 255, 1),
              inset 0 0 20px rgba(203, 213, 225, 0.3),
              0 1px 2px rgba(255, 255, 255, 1),
              0 2px 4px rgba(0, 0, 0, 0.1),
              0 8px 16px rgba(0, 0, 0, 0.08),
              0 16px 32px rgba(0, 0, 0, 0.06),
              0 24px 48px rgba(0, 0, 0, 0.04)
            `,
          border: isDark
            ? '2px solid rgba(51, 65, 85, 0.6)'
            : '2px solid rgba(203, 213, 225, 0.6)',
          position: 'relative',
        }}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        role="switch"
        aria-checked={isDark}
        whileTap={{ scale: 0.98 }}
      >
        {/* Deep inner groove/rim effect */}
        <div
          className="absolute inset-[3px] rounded-full pointer-events-none"
          style={{
            boxShadow: isDark
              ? 'inset 0 2px 6px rgba(0, 0, 0, 0.9), inset 0 -1px 3px rgba(71, 85, 105, 0.3)'
              : 'inset 0 2px 6px rgba(100, 116, 139, 0.4), inset 0 -1px 3px rgba(255, 255, 255, 0.8)',
          }}
        />

        {/* Multi-layer glossy overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: isDark
              ? `
                radial-gradient(ellipse at top, rgba(71, 85, 105, 0.15) 0%, transparent 50%),
                linear-gradient(to bottom, rgba(71, 85, 105, 0.2) 0%, transparent 30%, transparent 70%, rgba(0, 0, 0, 0.3) 100%)
              `
              : `
                radial-gradient(ellipse at top, rgba(255, 255, 255, 0.8) 0%, transparent 50%),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, transparent 30%, transparent 70%, rgba(148, 163, 184, 0.15) 100%)
              `,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Ambient occlusion effect */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: isDark
              ? 'inset 0 0 15px rgba(0, 0, 0, 0.5)'
              : 'inset 0 0 15px rgba(148, 163, 184, 0.2)',
          }}
        />
        {/* Background Icons */}
        <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: dims.bgPad, paddingRight: dims.bgPad }}>
          <Sun size={dims.icon} className={isDark ? 'text-yellow-100' : 'text-amber-600'} />
          <Moon size={dims.icon} className={isDark ? 'text-yellow-100' : 'text-slate-700'} />
        </div>

        {/* Circular Thumb with Bouncy Spring Physics */}
        <motion.div
          className="relative z-10 flex items-center justify-center rounded-full overflow-hidden"
          style={{
            width: dims.thumb,
            height: dims.thumb,
            background: isDark
              ? 'linear-gradient(145deg, #64748b 0%, #475569 50%, #334155 100%)'
              : 'linear-gradient(145deg, #ffffff 0%, #fefefe 50%, #f8fafc 100%)',
            boxShadow: isDark
              ? `
                inset 2px 2px 4px rgba(100, 116, 139, 0.4),
                inset -2px -2px 4px rgba(0, 0, 0, 0.8),
                inset 0 1px 1px rgba(255, 255, 255, 0.15),
                0 1px 2px rgba(255, 255, 255, 0.1),
                0 8px 32px rgba(0, 0, 0, 0.6),
                0 4px 12px rgba(0, 0, 0, 0.5),
                0 2px 4px rgba(0, 0, 0, 0.4)
              `
              : `
                inset 2px 2px 4px rgba(203, 213, 225, 0.3),
                inset -2px -2px 4px rgba(255, 255, 255, 1),
                inset 0 1px 2px rgba(255, 255, 255, 1),
                0 1px 2px rgba(255, 255, 255, 1),
                0 8px 32px rgba(0, 0, 0, 0.18),
                0 4px 12px rgba(0, 0, 0, 0.12),
                0 2px 4px rgba(0, 0, 0, 0.08)
              `,
            border: isDark
              ? '2px solid rgba(148, 163, 184, 0.3)'
              : '2px solid rgba(255, 255, 255, 0.9)',
          }}
          animate={{
            x: isDark ? dims.travel : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 300, // Fast, responsive movement
            damping: 20, // Bouncy feel with slight overshoot
          }}
        >
          {/* Glossy shine overlay on thumb */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 0%, transparent 40%, rgba(0, 0, 0, 0.1) 100%)',
              mixBlendMode: 'overlay',
            }}
          />
          {/* Particle Layer - expanding circles from center with grainy texture */}
          {isAnimating && particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: '10px',
                  height: '10px',
                  background: isDark
                    ? 'radial-gradient(circle, rgba(147, 197, 253, 0.5) 0%, rgba(147, 197, 253, 0) 70%)'
                    : 'radial-gradient(circle, rgba(251, 191, 36, 0.7) 0%, rgba(251, 191, 36, 0) 70%)',
                  mixBlendMode: 'normal',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: isDark ? 6 : 8, opacity: [0, 1, 0] }}
                transition={{
                  duration: isDark ? 0.5 : particle.duration,
                  delay: particle.delay,
                  ease: 'easeOut',
                }}
              >
                {/* Grainy texture overlay */}
                <div
                  className="absolute inset-0 rounded-full opacity-40"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    mixBlendMode: 'overlay',
                  }}
                />
              </motion.div>
            </motion.div>
          ))}

          {/* Icon */}
          <div className="relative z-10">
            {isDark ? (
              <Moon size={dims.icon} className="text-yellow-200" />
            ) : (
              <Sun size={dims.icon} className="text-amber-500" />
            )}
          </div>
        </motion.div>
      </motion.button>
    </div>
  );
}

export default CinematicThemeSwitcher;
