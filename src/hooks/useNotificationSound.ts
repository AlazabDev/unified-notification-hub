import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CHANNELS_BY_ID,
  loadChannelSettings,
  resolveChannelId,
} from "@/lib/notification-channels";

import stylishUrl from "@/assets/sound/stylish.mp3";
import messageUrl from "@/assets/sound/message.mp3";
import notificationUrl from "@/assets/sound/notification.mp3";
import previewUrl from "@/assets/sound/preview.mp3";

export type SoundKey = "stylish" | "message" | "notification" | "preview";

export const SOUND_OPTIONS: { key: SoundKey; label: string; url: string }[] = [
  { key: "stylish", label: "Stylish", url: stylishUrl },
  { key: "message", label: "Message", url: messageUrl },
  { key: "notification", label: "Notification", url: notificationUrl },
  { key: "preview", label: "Preview", url: previewUrl },
];

const SOUND_URL: Record<SoundKey, string> = {
  stylish: stylishUrl,
  message: messageUrl,
  notification: notificationUrl,
  preview: previewUrl,
};

const LS_ENABLED = "az_notify_sound_enabled";
const LS_SOUND = "az_notify_sound_key";

export function useNotificationSound(onIncoming?: () => void) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(LS_ENABLED) !== "0";
  });
  const [soundKey, setSoundKeyState] = useState<SoundKey>(() => {
    if (typeof window === "undefined") return "stylish";
    return (window.localStorage.getItem(LS_SOUND) as SoundKey) || "stylish";
  });

  // A pool of pre-loaded audio elements, one per sound.
  const poolRef = useRef<Record<SoundKey, HTMLAudioElement> | null>(null);
  const enabledRef = useRef(enabled);
  const defaultSoundRef = useRef<SoundKey>(soundKey);
  const onIncomingRef = useRef(onIncoming);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    defaultSoundRef.current = soundKey;
  }, [soundKey]);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  useEffect(() => {
    const pool: Record<SoundKey, HTMLAudioElement> = {
      stylish: new Audio(SOUND_URL.stylish),
      message: new Audio(SOUND_URL.message),
      notification: new Audio(SOUND_URL.notification),
      preview: new Audio(SOUND_URL.preview),
    };
    for (const a of Object.values(pool)) {
      a.preload = "auto";
      a.volume = 0.7;
    }
    poolRef.current = pool;
    return () => {
      for (const a of Object.values(pool)) a.pause();
      poolRef.current = null;
    };
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      window.localStorage.setItem(LS_ENABLED, v ? "1" : "0");
    } catch {}
  }, []);

  const setSoundKey = useCallback((k: SoundKey) => {
    setSoundKeyState(k);
    try {
      window.localStorage.setItem(LS_SOUND, k);
    } catch {}
  }, []);

  const playSound = useCallback((key: SoundKey) => {
    const a = poolRef.current?.[key];
    if (!a) return;
    try {
      a.currentTime = 0;
      void a.play().catch(() => {});
    } catch {}
  }, []);

  const play = useCallback(
    (key?: SoundKey) => {
      if (!enabledRef.current) return;
      playSound(key ?? defaultSoundRef.current);
    },
    [playSound],
  );

  // Realtime subscription — per-channel sound & mute.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    try {
      channel = supabase
        .channel("notifications-stream")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            onIncomingRef.current?.();
            if (!enabledRef.current) return;

            const row = payload.new as {
              event_type?: string | null;
              raw?: unknown;
            } | null;

            const channelId = row ? resolveChannelId(row) : null;
            if (channelId) {
              const def = CHANNELS_BY_ID[channelId];
              const s = loadChannelSettings(channelId);
              if (s.muted || def?.importance === "min") return;
              playSound(s.sound);
              return;
            }
            // Unknown channel → default sound
            playSound(defaultSoundRef.current);
          },
        )
        .subscribe();
    } catch (error) {
      console.error("supabase_realtime_subscription_failed", error);
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [playSound]);

  return { enabled, setEnabled, soundKey, setSoundKey, play, playSound };
}

