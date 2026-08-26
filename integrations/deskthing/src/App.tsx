/**
 * DeskThing client UI for airplay-status (P8).
 * Renders now-playing / idle from the state pushed by server/index.ts, applies
 * "screen off" intent, and shows a "tap to resume" splash for the focus-before-idle
 * nudge. Verify DeskThing client hooks against the SDK version you pin.
 */
import { useEffect, useState } from 'react';
import { DeskThing } from '@deskthing/client';
import './App.css';

type Playback = {
  isPlaying?: boolean;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArt?: string | null;
  progressMs?: number;
  durationMs?: number;
  source?: string | null;
};

type DisplayState = {
  mode: 'playing' | 'paused' | 'idle';
  screen: 'awake' | 'dim';
  focusBeforeIdle: boolean;
  nudge: boolean;
};

type DisplayMsg = { playback: Playback | null; state: DisplayState; keepScreenOn: boolean };

const fmt = (ms = 0) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function App() {
  const [msg, setMsg] = useState<DisplayMsg | null>(null);

  useEffect(() => {
    const off = DeskThing.on('display', (data: { payload: DisplayMsg }) => setMsg(data.payload));

    // Report focus so the server can gate the resume nudge (focus-before-idle).
    const onVis = () => DeskThing.send({ type: 'focus', payload: !document.hidden });
    document.addEventListener('visibilitychange', onVis);
    onVis();

    return () => {
      off?.();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const state = msg?.state;
  const pb = msg?.playback ?? null;
  const dimmed = state?.screen === 'dim' && !state?.nudge;

  if (state?.nudge) {
    return (
      <button
        className="resume"
        onClick={() => DeskThing.send({ type: 'dismissNudge' })}
      >
        <span className="resume__icon">▶</span>
        <span className="resume__text">Tap to resume</span>
      </button>
    );
  }

  if (!pb?.title || state?.mode === 'idle') {
    return (
      <div className={`stage idle ${dimmed ? 'dimmed' : ''}`}>
        <div className="idle__icon">🔇</div>
        <p className="idle__text">Nothing playing</p>
      </div>
    );
  }

  const pct = pb.durationMs ? Math.min(100, Math.round(((pb.progressMs ?? 0) / pb.durationMs) * 100)) : 0;

  return (
    <div className={`stage now ${dimmed ? 'dimmed' : ''}`}>
      {pb.albumArt ? (
        <img className="art" src={pb.albumArt} alt="" />
      ) : (
        <div className="art art--ph">🎵</div>
      )}
      <div className="meta">
        <h1 className="title">{pb.title}</h1>
        <p className="artist">{pb.artist}</p>
        <div className="bar">
          <div className="bar__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="times">
          <span>{fmt(pb.progressMs)}</span>
          <span>{fmt(pb.durationMs)}</span>
        </div>
        <div className="status">
          <span>{pb.isPlaying ? '▶ Playing' : '⏸ Paused'}</span>
          <span className="src">{pb.source ?? 'AirPlay'}</span>
        </div>
      </div>
    </div>
  );
}
