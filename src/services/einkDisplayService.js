import crypto from 'node:crypto';
import sharp from 'sharp';
import { computeEinkDisplay } from '../lib/einkDeviceProfile.js';
import { getActiveEinkProfiles, isEinkProfileActive } from '../lib/einkClientRegistry.js';

const cache = new Map();

const truncate = (text, maxLen) => {
  if (!text) return '';
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`;
};

const buildSvg = (playback, profile, display) => {
  const width = profile.pngWidth;
  const height = profile.pngHeight;
  const title = truncate(playback.title, 48) || 'Nothing playing';
  const artist = truncate(playback.artist, 56) || '';
  const album = truncate(playback.album, 56) || '';
  const status = playback.title
    ? playback.isPlaying
      ? 'Playing'
      : 'Paused'
    : 'Select AirPlay Status';
  const progress = playback.title ? display.progressText : '';

  let barSvg = '';
  if (display.segmentCount > 0 && profile.showProgressBar) {
    const segW = Math.floor((profile.progressBarPx - display.segmentCount) / display.segmentCount);
    const barX = 40;
    const barY = 220;
    for (let i = 0; i < display.segmentCount; i += 1) {
      const x = barX + i * (segW + 1);
      const fill = i < display.filledSegments ? '#000' : '#fff';
      const stroke = '#000';
      barSvg += `<rect x="${x}" y="${barY}" width="${segW}" height="12" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="40" y="70" font-family="sans-serif" font-size="36" font-weight="700" fill="#000">${escapeXml(title)}</text>
  <text x="40" y="110" font-family="sans-serif" font-size="24" fill="#000">${escapeXml(artist)}</text>
  <text x="40" y="145" font-family="sans-serif" font-size="20" fill="#333">${escapeXml(album)}</text>
  <text x="40" y="185" font-family="sans-serif" font-size="18" fill="#000">${escapeXml(progress)} · ${escapeXml(status)}</text>
  ${barSvg}
</svg>`;
};

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const computeEtag = (profileId, playback, display) => {
  const payload = JSON.stringify({
    profileId,
    title: playback.title,
    artist: playback.artist,
    album: playback.album,
    isPlaying: playback.isPlaying,
    filledSegments: display.filledSegments,
    progressText: display.progressText,
  });
  return `"${crypto.createHash('sha1').update(payload).digest('hex')}"`;
};

export const invalidateEinkCache = (profileIds = null) => {
  if (!profileIds) {
    cache.clear();
    return;
  }
  for (const id of profileIds) {
    cache.delete(id);
  }
};

export const renderEinkPng = async (profileId, profile, playback) => {
  const display = computeEinkDisplay(playback, profile);
  const etag = computeEtag(profileId, playback, display);
  const cached = cache.get(profileId);
  if (cached?.etag === etag) {
    return { buffer: cached.buffer, etag, fromCache: true };
  }

  const svg = buildSvg(playback, profile, display);
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  cache.set(profileId, { buffer, etag, renderedAt: Date.now() });
  return { buffer, etag, fromCache: false };
};

export const onPlaybackChangeForEink = (playback, profileResolver) => {
  const active = getActiveEinkProfiles();
  if (active.length === 0) return;
  invalidateEinkCache(active);
};

export const isProfileActiveForRender = (profileId) => isEinkProfileActive(profileId);
