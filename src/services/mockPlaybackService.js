/**
 * Mock playback service — dummy data matching specs/p0-airplay-status.md
 */

let mockPlaying = true;

export const resetMockPlayback = () => {
  mockPlaying = true;
};

export const applyMockControl = (action) => {
  if (action === 'pause') mockPlaying = false;
  else if (action === 'play') mockPlaying = true;
  else if (action === 'toggle') mockPlaying = !mockPlaying;
  return { ok: true, action, reason: null };
};

export const getPlaybackState = async (forceNothingPlaying = false) => {
  if (forceNothingPlaying) {
    return {
      isPlaying: false,
      title: null,
      artist: null,
      album: null,
      albumArt: null,
      progressMs: 0,
      durationMs: 0,
      source: null,
      updatedAt: null,
      controlAvailable: false,
      controlReason: 'no_session',
    };
  }

  return {
    isPlaying: mockPlaying,
    title: 'Señorita',
    artist: 'Shawn Mendes, Camila Cabello',
    album: 'Señorita',
    albumArt: '/images/album-art.png',
    progressMs: 95000,
    durationMs: 191000,
    source: 'Mock Player',
    updatedAt: new Date().toISOString(),
    controlAvailable: true,
    controlReason: null,
  };
};
