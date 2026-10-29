"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth";

const PHOTO_EVENT = "tf_user_photo_updated";

export function useUserPhoto(): {
  photoUrl: string | null;
  setPhotoUrl: (url: string | null) => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const storageKey = `tf_user_photo_${userId}`;

  const [photoUrl, setLocalPhotoUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(storageKey) || user?.avatarUrl || null;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(storageKey);
    setLocalPhotoUrl(stored || user?.avatarUrl || null);
  }, [storageKey, user?.avatarUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId: string; photoUrl: string | null }>;
      if (customEvent.detail?.userId === userId) {
        setLocalPhotoUrl(customEvent.detail.photoUrl);
      }
    };
    window.addEventListener(PHOTO_EVENT, handler);
    return () => window.removeEventListener(PHOTO_EVENT, handler);
  }, [userId]);

  const setPhotoUrl = useCallback(
    (newUrl: string | null) => {
      if (typeof window === "undefined") return;
      if (newUrl) {
        localStorage.setItem(storageKey, newUrl);
      } else {
        localStorage.removeItem(storageKey);
      }
      setLocalPhotoUrl(newUrl);
      window.dispatchEvent(
        new CustomEvent(PHOTO_EVENT, { detail: { userId, photoUrl: newUrl } }),
      );
    },
    [storageKey, userId],
  );

  return { photoUrl, setPhotoUrl };
}
