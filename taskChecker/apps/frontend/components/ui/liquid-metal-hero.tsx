"use client";

import { LiquidMetal, liquidMetalPresets } from '@paper-design/shaders-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

interface LiquidMetalHeroProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  onPrimaryCtaClick: () => void;
  onSecondaryCtaClick?: () => void;
  features?: string[];
}

export default function LiquidMetalHero({
  badge,
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  onPrimaryCtaClick,
  onSecondaryCtaClick,
  features = [],
}: LiquidMetalHeroProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.2,
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
    },
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Shader is scoped to this section (absolute, not fixed) so it never
          leaks behind /app/board or dialogs. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <LiquidMetal
          {...liquidMetalPresets[2]}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div className="container mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          className="space-y-8 text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {badge && (
            <motion.div className="flex justify-center" variants={itemVariants}>
              <Badge
                variant="secondary"
                className="gap-1.5 border-foreground/20 bg-foreground/10 text-foreground backdrop-blur-sm transition-colors duration-300 hover:bg-foreground/20"
              >
                <Sparkles className="size-3.5" aria-hidden />
                {badge}
              </Badge>
            </motion.div>
          )}

          <motion.div className="space-y-6" variants={itemVariants}>
            <motion.h1
              className="text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-8xl"
              variants={itemVariants}
            >
              {title}
            </motion.h1>

            <motion.p
              className="mx-auto max-w-3xl text-xl leading-relaxed text-foreground/90 sm:text-2xl"
              variants={itemVariants}
            >
              {subtitle}
            </motion.p>
          </motion.div>

          <motion.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            variants={buttonVariants}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={onPrimaryCtaClick}
                size="lg"
                className="gap-2 bg-foreground px-8 py-6 text-lg font-semibold text-background shadow-2xl transition-all duration-300 hover:bg-foreground/90"
              >
                {primaryCtaLabel}
                <ArrowRight className="size-5" aria-hidden />
              </Button>
            </motion.div>

            {secondaryCtaLabel && onSecondaryCtaClick && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={onSecondaryCtaClick}
                  variant="outline"
                  size="lg"
                  className="border-foreground/30 bg-background/10 px-8 py-6 text-lg font-semibold text-foreground backdrop-blur-sm transition-all duration-300 hover:border-foreground/50 hover:bg-foreground/10"
                >
                  {secondaryCtaLabel}
                </Button>
              </motion.div>
            )}
          </motion.div>

          {features.length > 0 && (
            <motion.div className="pt-12" variants={itemVariants}>
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
                <Card className="border-foreground/20 bg-foreground/10 shadow-2xl backdrop-blur-md">
                  <CardContent className="p-8">
                    <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      {features.map((feature, index) => (
                        <motion.li
                          key={feature}
                          className="flex items-center justify-center gap-2 text-center"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.6,
                            delay: 0.8 + index * 0.1,
                          }}
                        >
                          <Check
                            className="size-5 shrink-0 text-foreground"
                            aria-hidden
                          />
                          <p className="text-lg font-medium text-foreground/90">
                            {feature}
                          </p>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
