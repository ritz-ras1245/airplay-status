/**
 * Mock playback service — dummy data matching docs/spec.md
 */
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
    };
  }

  return {
    isPlaying: true,
    title: 'Señorita',
    artist: 'Shawn Mendes, Camila Cabello',
    album: 'Señorita',
    albumArt: '/images/album-art.png',
    progressMs: 95000,
    durationMs: 191000,
    source: 'Mock Player',
    updatedAt: new Date().toISOString(),
  };
};
