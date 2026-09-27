"use client";

import { useRef, useEffect, useCallback, useState, useSyncExternalStore } from "react";

/**
 * advanced-use-latest: useLatest for stable callback refs
 * Returns a ref that always points to the latest value
 * Useful for event handlers that need current values without re-creating
 */
export function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  // Sync in an effect (not during render) so render stays pure.
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * advanced-event-handler-refs: Store event handlers in refs
 * Avoids adding/removing event listeners on every render
 */
export function useEventCallback<Args extends unknown[], R>(
  fn: (...args: Args) => R
): (...args: Args) => R {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useCallback((...args: Args) => {
    return ref.current(...args);
  }, []);
}

/**
 * advanced-init-once: Initialize once per app load
 * Runs the initialization function only once across all component instances
 */
const initOnceMap = new Map<string, boolean>();

export function useInitOnce(key: string, initFn: () => void | Promise<void>): void {
  const initializedRef = useRef(false);
  
  useEffect(() => {
    if (initializedRef.current) return;
    if (initOnceMap.get(key)) return;
    
    initializedRef.current = true;
    initOnceMap.set(key, true);
    
    const result = initFn();
    if (result instanceof Promise) {
      result.catch(() => {
        // If init fails, allow retry
        initOnceMap.delete(key);
        initializedRef.current = false;
      });
    }
  }, [key, initFn]);
}

/**
 * Hook for stable event handler refs with automatic cleanup
 * Use for window/document event listeners that should be deduplicated
 */
export function useGlobalEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void {
  const listenerRef = useRef(listener);
  // Keep the latest listener without re-subscribing; sync in an effect so
  // render stays pure.
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    const handler = (event: WindowEventMap[K]) => listenerRef.current(event);
    window.addEventListener(type, handler, options);
    return () => window.removeEventListener(type, handler, options as boolean | EventListenerOptions);
  }, [type, options]);
}

/**
 * Hook for media query matching with SSR support
 */
export function useMediaQuery(query: string): boolean {
  // Lazy initializer reads the client-only source once (no sync setState).
  const [matches, setMatches] = useState(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia !== "undefined"
        ? window.matchMedia(query).matches
        : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    // Sync the current value in a subscription callback (not synchronously
    // in the effect body) to avoid a cascading render.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setMatches(mediaQuery.matches);
    });

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handler);

    return () => {
      cancelled = true;
      mediaQuery.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}

/**
 * Hook for debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeoutId);
  }, [value, delay]);
  
  return debounced;
}

/**
 * Hook for previous value
 * Render-adjustment pattern: no refs, no effects, stays pure.
 */
export function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  const [current, setCurrent] = useState(value);
  if (value !== current) {
    setPrev(current);
    setCurrent(value);
  }
  return prev;
}

/**
 * Hook for mounted state (useful for avoiding SSR hydration mismatches)
 * Subscription-based (no setState-in-effect): false on the server, true once
 * subscribed on the client.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Hook for reading/writing to a ref with a callback
 * Useful for advanced patterns where you need to read current value in callbacks
 */
export function useRefCallback<T>(
  callback: (ref: React.MutableRefObject<T>) => void
): React.MutableRefObject<T> {
  const ref = useRef<T>(null as unknown as T);
  
  useEffect(() => {
    callback(ref);
  }, [callback]);
  
  return ref;
}