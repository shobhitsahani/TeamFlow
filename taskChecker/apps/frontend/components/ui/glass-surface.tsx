"use client";

import React, { forwardRef, type HTMLAttributes } from "react";
import { cx } from "@/lib/utils";

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2 | 3;
  as?: React.ElementType;
}

/**
 * GlassSurface provides the 3-tier elevation glassmorphic layer
 * - Elevation 1: Shallow floating strips, filter bars, column headers
 * - Elevation 2: Navigation sidebars, top app bar, dropdown menus, popovers
 * - Elevation 3: Modals, slide-over task drawers, command palette
 *
 * Automatically includes backdrop-filter blur, saturate, 1px border,
 * top-edge highlight inset, and solid fallback for reduced transparency / non-supporting browsers.
 */
export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  ({ elevation = 2, as: Component = "div", className, children, ...props }, ref) => {
    const elevationClass =
      elevation === 1
        ? "glass-surface-1"
        : elevation === 3
          ? "glass-surface-3"
          : "glass-surface-2";

    return (
      <Component
        ref={ref}
        className={cx(
          elevationClass,
          "transition-colors duration-150",
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GlassSurface.displayName = "GlassSurface";
