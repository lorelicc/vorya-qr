"use client";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useRef, useState } from "react";
import type { AudioPlayerBlock, PageFiles } from "@/lib/page-types";
import styles from "./page.module.css";

const time = (s: number) =>
  Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "0:00";

/** Playlist on a single native <audio> (Range requests make seeking work on iPhone). */
export function AudioPlayer({ block, files }: { block: AudioPlayerBlock; files: PageFiles }) {
  const audio = useRef<HTMLAudioElement>(null);
  const tracks = block.tracks.filter((t) => files[t.file_id]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  if (!tracks.length) return null;
  const track = tracks[index];

  function go(next: number, autoplay = true) {
    const target = (next + tracks.length) % tracks.length;
    setIndex(target);
    setPosition(0);
    requestAnimationFrame(() => autoplay && audio.current?.play().catch(() => setPlaying(false)));
  }

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  return (
    <section className={styles.player} data-playing={playing || undefined}>
      <audio
        ref={audio}
        src={files[track.file_id].urls.original}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => (index < tracks.length - 1 ? go(index + 1) : setPlaying(false))}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className={styles.now}>
        <strong>{track.title}</strong>
        {track.artist && <span>{track.artist}</span>}
      </div>
      <input
        className={styles.seek}
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={position}
        aria-label="Posizione nella traccia"
        onChange={(e) => {
          const value = Number(e.target.value);
          if (audio.current) audio.current.currentTime = value;
          setPosition(value);
        }}
      />
      <div className={styles.times}>
        <span>{time(position)}</span>
        <span>{time(duration)}</span>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          aria-label="Traccia precedente"
          onClick={() => go(index - 1)}
          disabled={tracks.length < 2}
        >
          <SkipBack size={22} />
        </button>
        <button
          type="button"
          className={styles.play}
          aria-label={playing ? "Pausa" : "Riproduci"}
          onClick={toggle}
        >
          {playing ? <Pause size={28} /> : <Play size={28} />}
        </button>
        <button
          type="button"
          aria-label="Traccia successiva"
          onClick={() => go(index + 1)}
          disabled={tracks.length < 2}
        >
          <SkipForward size={22} />
        </button>
      </div>
      {tracks.length > 1 && (
        <ol className={styles.tracks}>
          {tracks.map((t, i) => (
            <li key={t.file_id + i}>
              <button type="button" aria-current={i === index || undefined} onClick={() => go(i)}>
                <span>{i + 1}</span> {t.title}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
