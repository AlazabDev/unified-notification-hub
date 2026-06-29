import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(enabled);
  const onIncomingRef = useRef(onIncoming);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  useEffect(() => {
    const opt = SOUND_OPTIONS.find((s) => s.key === soundKey) ?? SOUND_OPTIONS[0];
    const audio = new Audio(opt.url);
    audio.preload = "auto";
    audio.volume = 0.7;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [soundKey]);

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

  const play = useCallback(() => {
    if (!enabledRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      void a.play().catch(() => {});
    } catch {}
  }, []);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    try {
      channel = supabase
        .channel("notifications-stream")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          () => {
            onIncomingRef.current?.();
            if (enabledRef.current) play();
          },
        )
        .subscribe();
    } catch (error) {
      console.error("supabase_realtime_subscription_failed", error);
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [play]);

  return { enabled, setEnabled, soundKey, setSoundKey, play };
}
