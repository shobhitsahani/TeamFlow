"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

// The main hero component customized for TeamFlow with pure black theme
const AetherFlowHero = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const mouse: { x: number | null; y: number | null; radius: number } = {
      x: null,
      y: null,
      radius: 200,
    };

    class Particle {
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      size: number;
      color: string;

      constructor(
        x: number,
        y: number,
        directionX: number,
        directionY: number,
        size: number,
        color: string
      ) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
      }

      update() {
        if (!canvas) return;
        if (this.x > canvas.width || this.x < 0) {
          this.directionX = -this.directionX;
        }
        if (this.y > canvas.height || this.y < 0) {
          this.directionY = -this.directionY;
        }

        // Mouse collision detection
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius + this.size) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (mouse.radius - distance) / mouse.radius;
            this.x -= forceDirectionX * force * 5;
            this.y -= forceDirectionY * force * 5;
          }
        }

        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    function init() {
      if (!canvas) return;
      particles = [];
      const numberOfParticles = (canvas.height * canvas.width) / 9000;
      for (let i = 0; i < numberOfParticles; i++) {
        const size = Math.random() * 2 + 1;
        const x =
          Math.random() * (window.innerWidth - size * 2 - size * 2) +
          size * 2;
        const y =
          Math.random() * (window.innerHeight - size * 2 - size * 2) +
          size * 2;
        const directionX = Math.random() * 0.4 - 0.2;
        const directionY = Math.random() * 0.4 - 0.2;
        const color = "rgba(198, 147, 253, 0.95)"; // Exact lavender node color from reference image
        particles.push(
          new Particle(x, y, directionX, directionY, size, color)
        );
      }
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const connect = () => {
      for (let a = 0; a < particles.length; a++) {
        const pA = particles[a];
        if (!pA) continue;
        for (let b = a; b < particles.length; b++) {
          const pB = particles[b];
          if (!pB) continue;
          const distance =
            (pA.x - pB.x) * (pA.x - pB.x) +
            (pA.y - pB.y) * (pA.y - pB.y);

          if (distance < (canvas.width / 7) * (canvas.height / 7)) {
            const opacityValue = 1 - distance / 20000;

            if (mouse.x !== null && mouse.y !== null) {
              const dx_mouse_a = pA.x - mouse.x;
              const dy_mouse_a = pA.y - mouse.y;
              const distance_mouse_a = Math.sqrt(
                dx_mouse_a * dx_mouse_a + dy_mouse_a * dy_mouse_a
              );

              if (distance_mouse_a < mouse.radius) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue})`;
              } else {
                ctx.strokeStyle = `rgba(200, 150, 255, ${opacityValue})`;
              }
            } else {
              ctx.strokeStyle = `rgba(200, 150, 255, ${opacityValue})`;
            }

            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p) p.update();
      }
      connect();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseout", handleMouseOut);

    init();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseout", handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const fadeUpVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.18 + 0.3,
        duration: 0.8,
        ease: "easeInOut",
      },
    }),
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Interactive Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />

      {/* Top Floating Navigation */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md transition-all group-hover:border-white/25 shadow-lg shadow-black">
            <Image
              src="/logo_mark.png"
              alt="TeamFlow"
              width={22}
              height={22}
              className="object-contain"
            />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">TeamFlow</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <Link
            href="/app/board"
            className="text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/5"
          >
            Board
          </Link>
          <Link
            href="/app/projects"
            className="text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/5 hidden sm:inline-block"
          >
            Projects
          </Link>
          <Link
            href="/app/teams"
            className="text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/5 hidden sm:inline-block"
          >
            Teams
          </Link>
          <Link href="/auth/sign-in">
            <span className="inline-flex items-center rounded-lg bg-white hover:bg-zinc-200 px-4 py-1.5 text-xs sm:text-sm font-semibold text-black transition-all shadow-md shadow-black/40">
              Sign in
            </span>
          </Link>
        </nav>
      </header>

      {/* Hero Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 pt-24 pb-16 max-w-4xl mx-auto">
        <motion.h1
          custom={0}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-100 to-zinc-400 drop-shadow-sm select-none"
        >
          TeamFlow
        </motion.h1>

        <motion.p
          custom={1}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed font-normal"
        >
          The quiet harbor for high-velocity teams. Plan, assign, and track work
          across projects with hard tenant isolation and sub-second realtime sync.
        </motion.p>

        <motion.div
          custom={2}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/app/board">
            <button className="group px-7 py-3.5 bg-white text-black font-semibold rounded-xl shadow-xl shadow-black hover:bg-zinc-200 transition-all duration-300 flex items-center gap-2 hover:gap-3 cursor-pointer text-sm sm:text-base">
              Open your board
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Link>

          <Link href="/auth/sign-in">
            <button className="px-6 py-3.5 rounded-xl border border-white/20 bg-white/5 text-zinc-200 font-medium backdrop-blur-md hover:bg-white/10 hover:border-white/40 hover:text-white transition-all duration-300 cursor-pointer text-sm sm:text-base">
              Sign in
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export { AetherFlowHero };
export default AetherFlowHero;
