import { useEffect, useRef, type Dispatch } from "react";
import type { AppAction } from "../app/model";
import type { Song } from "../lib/heapbeat";

export function resolveAudioSource(
  sourceUrl: string,
  documentUrl = window.location.href,
  baseUrl = import.meta.env.BASE_URL,
) {
  if (/^(?:https?:|blob:|data:)/i.test(sourceUrl)) {
    return sourceUrl;
  }

  const applicationBase = new URL(baseUrl, documentUrl);
  return new URL(sourceUrl.replace(/^\/+/, ""), applicationBase).href;
}

function seekWhenReady(audio: HTMLAudioElement, seconds: number) {
  const apply = () => {
    const upperBound = Number.isFinite(audio.duration)
      ? audio.duration
      : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, upperBound));
  };

  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    apply();
    return () => {};
  }

  audio.addEventListener("loadedmetadata", apply, { once: true });
  return () => audio.removeEventListener("loadedmetadata", apply);
}

/**
 * Drives the room speaker with the browser's native HTML audio element.
 * Tracks are loaded directly from the bundled piano library.
 */
export function useAudioPlayer(
  enabled: boolean,
  isPlaying: boolean,
  song: Song | null,
  volume: number,
  progressSec: number,
  activeRoomName: string,
  seekTrigger: number,
  dispatch: Dispatch<AppAction>,
  onEnded: () => void,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef(progressSec);
  progressRef.current = progressSec;

  const trackKey =
    enabled && song ? `${activeRoomName}::${song.id}::${song.sourceUrl}` : null;

  useEffect(() => {
    if (!trackKey || !song) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    const audio = new Audio(resolveAudioSource(song.sourceUrl));
    audio.preload = "metadata";
    audio.loop = false;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    audioRef.current = audio;

    const cancelInitialSeek = seekWhenReady(audio, progressRef.current);
    let lastWholeSecond = Math.floor(progressRef.current);

    const handleTimeUpdate = () => {
      const wholeSecond = Math.floor(audio.currentTime);
      if (wholeSecond !== lastWholeSecond) {
        lastWholeSecond = wholeSecond;
        dispatch({
          type: "TICK",
          now: Date.now(),
          actualTime: wholeSecond,
        });
      }
    };

    const handleEnded = () => {
      onEnded();
    };

    const handleError = () => {
      dispatch({
        type: "SET_FEEDBACK",
        feedback: {
          tone: "danger",
          message: `Audio file unavailable: ${song.title}.`,
        },
        auditMessage: `Audio load failed: ${song.sourceUrl}`,
        now: Date.now(),
      });
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      cancelInitialSeek();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [dispatch, enabled, onEnded, trackKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackKey) {
      return;
    }

    if (!isPlaying) {
      audio.pause();
      return;
    }

    let disposed = false;
    let retryOnGesture: (() => void) | null = null;

    const removeRetryListeners = () => {
      if (!retryOnGesture) {
        return;
      }
      document.removeEventListener("pointerdown", retryOnGesture);
      document.removeEventListener("keydown", retryOnGesture);
      retryOnGesture = null;
    };

    const attemptPlay = () => {
      void audio
        .play()
        .then(removeRetryListeners)
        .catch((error: unknown) => {
          if (
            disposed ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            return;
          }

          if (!retryOnGesture) {
            retryOnGesture = attemptPlay;
            document.addEventListener("pointerdown", retryOnGesture);
            document.addEventListener("keydown", retryOnGesture);
          }
        });
    };

    attemptPlay();

    return () => {
      disposed = true;
      removeRetryListeners();
      audio.pause();
    };
  }, [isPlaying, trackKey]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }, [volume, trackKey]);

  useEffect(() => {
    if (seekTrigger === 0 || !audioRef.current) {
      return;
    }

    return seekWhenReady(audioRef.current, progressRef.current);
  }, [seekTrigger]);
}
