/**
 * Mock playback service — dummy data matching specs/p0-airplay-status.md
 * plus a second Spotify adapter for P11 one-by-one rotation.
 */
import { emptyPlayback } from '../lib/sourceRotate.js';

const mockNow = () => new Date().toISOString();

const airplayTrack = () => ({
  isPlaying: true,
  title: 'Señorita',
  artist: 'Shawn Mendes, Camila Cabello',
  album: 'Señorita',
  albumArt: '/images/album-art.png',
  progressMs: 95000,
  durationMs: 191000,
  source: 'AirPlay',
  sourceId: 'airplay',
  updatedAt: mockNow(),
});

const spotifyTrack = () => ({
  isPlaying: true,
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  album: 'After Hours',
  albumArt: '/images/album-art.png',
  progressMs: 42000,
  durationMs: 200000,
  source: 'Spotify',
  sourceId: 'spotify',
  updatedAt: mockNow(),
});

export const getMockSources = (forceNothingPlaying = false) => {
  if (forceNothingPlaying) {
    return {
      airplay: emptyPlayback('airplay'),
      spotify: emptyPlayback('spotify'),
    };
  }
  return {
    airplay: airplayTrack(),
    spotify: spotifyTrack(),
  };
};

export const getPlaybackState = async (forceNothingPlaying = false) =>
  getMockSources(forceNothingPlaying).airplay;
