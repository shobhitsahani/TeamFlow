"use client";

import * as React from "react";
import { Download, FileText, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatAudioPlayerProps {
  url: string;
  name: string;
  size?: number;
  mime?: string;
  isOwn?: boolean;
  className?: string;
}

function formatDuration(sec: number): string {
  if (isNaN(sec) || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function ChatAudioPlayer({
  url,
  name,
  size,
  mime = "audio/webm",
  isOwn = false,
  className,
}: ChatAudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  const isAudio = mime.startsWith("audio/");

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  if (!isAudio) {
    // Document/file card
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-2.5 rounded-xl border select-none transition-colors max-w-sm shadow-xs",
          isOwn
            ? "bg-purple-700/30 border-purple-400/30 text-white"
            : "bg-[var(--tf-card-bg)] border-[var(--tf-border)] text-[var(--tf-fg)]",
          className
        )}
      >
        <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-600 dark:text-purple-300">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate text-current">{name}</div>
          {size ? (
            <div className={cn("text-[10px] font-mono", isOwn ? "text-purple-200" : "text-[var(--tf-fg-muted)]")}>
              {formatBytes(size)}
            </div>
          ) : null}
        </div>
        <a
          href={url}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--tf-hover-bg)] shrink-0 text-current opacity-80 hover:opacity-100"
          title="Download file"
          aria-label={`Download ${name}`}
        >
          <Download className="size-4" />
        </a>
      </div>
    );
  }

  // Audio voice note player
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-2.5 rounded-xl border select-none transition-colors w-68 max-w-full shadow-xs",
        isOwn
          ? "bg-purple-700/30 border-purple-400/30 text-white"
          : "bg-[var(--tf-card-bg)] border-[var(--tf-border)] text-[var(--tf-fg)]",
        className
      )}
    >
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="size-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 bg-purple-600 text-white hover:bg-purple-500"
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono leading-none">
            <span className="truncate font-medium text-current">{name}</span>
            <span className={cn(isOwn ? "text-purple-200" : "text-[var(--tf-fg-muted)]")}>
              {formatDuration(currentTime || duration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek audio position"
            className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-[var(--tf-hover-bg)] accent-purple-600"
          />
        </div>

        <a
          href={url}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-[var(--tf-hover-bg)] transition-colors shrink-0 text-current opacity-80 hover:opacity-100"
          title="Download audio"
          aria-label={`Download ${name}`}
        >
          <Download className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
