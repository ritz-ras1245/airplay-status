import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { getDeviceProfile } from '../lib/einkDeviceProfile.js';
import {
  buildEinkEtagPayload,
  buildEinkViewModel,
} from '../lib/einkDisplayMath.js';
import {
  configureClientEviction,
  getActiveProfiles,
  isProfileActive,
  startClientSweep,
  touchClient,
} from '../lib/einkClientRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const publicDir = path.join(projectRoot, 'src/public');

/** @type {Map<string, { buffer: Buffer, etag: string, renderedAt: number }>} */
const pngCache = new Map();

let playbackInvalidationHooked = false;

const log = (...args) => console.log('[eink]', ...args);

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const computeEtag = (payload) => `"${crypto.createHash('sha1').update(payload).digest('hex')}"`;

const resolveArtPath = (albumArt) => {
  if (!albumArt) return null;
  if (albumArt.startsWith('/')) {
    return path.join(publicDir, albumArt.replace(/^\//, ''));
  }
  return null;
};

const loadArtworkDataUri = async (albumArt) => {
  const localPath = resolveArtPath(albumArt);
  if (!localPath) return null;

  try {
    const buffer = await fs.readFile(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
};

const buildSegmentBarSvg = (viewModel, profile, x, y) => {
  if (!viewModel.showProgressBar || viewModel.segmentCount <= 0) return '';

  const gap = 2;
  const segmentWidth =
    (profile.progressBarPx - gap * (viewModel.segmentCount - 1)) / viewModel.segmentCount;
  const height = 12;
  let segments = '';

  for (let i = 0; i < viewModel.segmentCount; i += 1) {
    const fill = i < viewModel.filledSegments ? '#000' : '#ccc';
    const sx = x + i * (segmentWidth + gap);
    segments += `<rect x="${sx.toFixed(1)}" y="${y}" width="${segmentWidth.toFixed(1)}" height="${height}" fill="${fill}"/>`;
  }

  return segments;
};

const buildSvg = async (viewModel, profile, { airplayReceiverName }) => {
  const width = profile.pngWidth;
  const height = profile.pngHeight;
  const padding = 32;
  let y = padding + 8;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#fff"/>`,
    `<style>text { font-family: sans-serif; fill: #000; }</style>`,
  ];

  if (!viewModel.hasTrack) {
    parts.push(
      `<text x="${padding}" y="${y + 40}" font-size="28" font-weight="700">Nothing playing</text>`,
      `<text x="${padding}" y="${y + 80}" font-size="18">Select ${escapeXml(airplayReceiverName)}</text>`,
      `<text x="${padding}" y="${y + 108}" font-size="18">as an AirPlay output.</text>`,
    );
    parts.push('</svg>');
    return parts.join('');
  }

  const artDataUri = await loadArtworkDataUri(viewModel.playback.albumArt);
  if (artDataUri) {
    const artSize = 120;
    parts.push(
      `<image href="${artDataUri}" x="${padding}" y="${y}" width="${artSize}" height="${artSize}"/>`,
    );
    y += artSize + 24;
  }

  parts.push(
    `<text x="${padding}" y="${y + 28}" font-size="26" font-weight="700">${escapeXml(viewModel.playback.title)}</text>`,
  );
  y += 44;

  if (viewModel.playback.artist) {
    parts.push(
      `<text x="${padding}" y="${y + 20}" font-size="20">${escapeXml(viewModel.playback.artist)}</text>`,
    );
    y += 32;
  }

  if (viewModel.playback.album) {
    parts.push(
      `<text x="${padding}" y="${y + 18}" font-size="16" fill="#333">${escapeXml(viewModel.playback.album)}</text>`,
    );
    y += 28;
  }

  parts.push(
    `<text x="${padding}" y="${y + 20}" font-size="16">${escapeXml(viewModel.playingLabel)}</text>`,
  );
  y += 28;

  if (viewModel.progressText) {
    parts.push(
      `<text x="${padding}" y="${y + 18}" font-size="16">${escapeXml(viewModel.progressText)}</text>`,
    );
    y += 24;
  }

  const barSvg = buildSegmentBarSvg(viewModel, profile, padding, y + 8);
  if (barSvg) {
    parts.push(barSvg);
  }

  parts.push('</svg>');
  return parts.join('');
};

const renderPng = async (svg) => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    background: '#ffffff',
  });
  return resvg.render().asPng();
};

export const evictPngCache = (profileId) => {
  pngCache.delete(profileId);
};

export const invalidateActivePngCaches = () => {
  for (const profileId of getActiveProfiles()) {
    evictPngCache(profileId);
  }
};

export const configureEinkDisplayService = ({ onPlaybackChange, getPlaybackState, airplayReceiverName }) => {
  configureClientEviction(evictPngCache);
  startClientSweep();

  if (!playbackInvalidationHooked && onPlaybackChange) {
    onPlaybackChange(() => {
      if (getActiveProfiles().length === 0) return;
      invalidateActivePngCaches();
    });
    playbackInvalidationHooked = true;
  }

  return {
    getPngResponse: async (deviceId, req) => {
      const device = getDeviceProfile(deviceId);
      touchClient(device.deviceId, 'png');

      const playback = await getPlaybackState(req);
      const viewModel = buildEinkViewModel(playback, device);
      const etagPayload = buildEinkEtagPayload(
        device.deviceId,
        playback,
        viewModel.filledSegments,
      );
      const etag = computeEtag(etagPayload);
      const ifNoneMatch = req.headers['if-none-match'];

      if (ifNoneMatch === etag) {
        return { status: 304, etag };
      }

      const cached = pngCache.get(device.deviceId);
      if (cached && cached.etag === etag) {
        return { status: 200, etag, buffer: cached.buffer, contentType: 'image/png' };
      }

      if (!isProfileActive(device.deviceId)) {
        log('skip render — profile not active after touch', device.deviceId);
      }

      const svg = await buildSvg(viewModel, device.profile, { airplayReceiverName });
      const buffer = await renderPng(svg);
      pngCache.set(device.deviceId, { buffer, etag, renderedAt: Date.now() });

      return { status: 200, etag, buffer, contentType: 'image/png' };
    },
  };
};

export const resetEinkDisplayServiceForTests = () => {
  pngCache.clear();
  playbackInvalidationHooked = false;
};
