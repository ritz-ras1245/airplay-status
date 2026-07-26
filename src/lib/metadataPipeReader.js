import fs from 'node:fs';
import path from 'node:path';

const TYPE_CORE = 0x636f7265;
const TYPE_SSNC = 0x73736e63;

const CODE = {
  TITLE: 0x6d696e6d,
  ARTIST: 0x61736172,
  ALBUM: 0x6173616c,
  TRACK_MS: 0x6173746d,
  PICT: 0x50494354,
  PROGRESS: 0x70726772,
  PLAY_BEGIN: 0x70626567,
  PLAY_END: 0x70656e64,
  PAUSE: 0x70617573,
  RESUME: 0x7072736d,
  CLIENT_NAME: 0x736e616d,
  CLIENT_MODEL: 0x636d6f64,
  SENDER: 0x736e6472,
  DISCONNECT: 0x64697363,
};

const SAMPLE_RATE = 44100;

export const parseMetadataItem = (xml) => {
  const type = parseInt(xml.match(/<type>([0-9a-f]+)<\/type>/i)?.[1] ?? '', 16);
  const code = parseInt(xml.match(/<code>([0-9a-f]+)<\/code>/i)?.[1] ?? '', 16);
  const length = Number(xml.match(/<length>(\d+)<\/length>/)?.[1] ?? 0);
  const dataBlock = xml.match(/<data encoding="base64">\s*([\s\S]*?)\s*<\/data>/);

  let data = null;
  if (dataBlock && length > 0) {
    data = Buffer.from(dataBlock[1].replace(/\s/g, ''), 'base64');
  }

  return { type, code, length, data };
};

const readUInt32Be = (buf) => (buf.length >= 4 ? buf.readUInt32BE(0) : 0);

const rtpToMs = (frames) => Math.max(0, Math.round((frames / SAMPLE_RATE) * 1000));

const parseSenderApp = (raw) => {
  const text = raw.trim();
  if (!text) return null;
  if (text.includes('Music')) return 'Apple Music';
  if (text.includes('Spotify')) return 'Spotify';
  const slash = text.indexOf('/');
  return slash > 0 ? text.slice(0, slash) : text;
};

export const itemToUpdate = (item) => {
  const { type, code, data } = item;

  if (type === TYPE_CORE && data) {
    if (code === CODE.TITLE) {
      return { type: 'field', field: 'title', value: data.toString('utf8') };
    }
    if (code === CODE.ARTIST) {
      return { type: 'field', field: 'artist', value: data.toString('utf8') };
    }
    if (code === CODE.ALBUM) {
      return { type: 'field', field: 'album', value: data.toString('utf8') };
    }
    if (code === CODE.TRACK_MS) {
      return { type: 'field', field: 'durationMs', value: readUInt32Be(data) };
    }
  }

  if (type === TYPE_SSNC) {
    if (code === CODE.CLIENT_NAME && data) {
      return { type: 'field', field: 'clientName', value: data.toString('utf8') };
    }
    if (code === CODE.CLIENT_MODEL && data) {
      return { type: 'field', field: 'clientModel', value: data.toString('utf8') };
    }
    if (code === CODE.SENDER && data) {
      const senderApp = parseSenderApp(data.toString('utf8'));
      return senderApp ? { type: 'field', field: 'senderApp', value: senderApp } : null;
    }
    if (code === CODE.PICT && data) {
      return { type: 'event', event: 'artwork', data };
    }
    if (code === CODE.PROGRESS && data) {
      const parts = data.toString('utf8').split('/').map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        const [start, current, end] = parts;
        return {
          type: 'field',
          field: 'progress',
          value: { progressMs: rtpToMs(current - start), durationMs: rtpToMs(end - start) },
        };
      }
    }
    if (code === CODE.DISCONNECT) return { type: 'event', event: 'disconnect' };
    if (code === CODE.PLAY_BEGIN) return { type: 'event', event: 'play' };
    if (code === CODE.PLAY_END) return { type: 'event', event: 'stop' };
    if (code === CODE.PAUSE) return { type: 'event', event: 'pause' };
    if (code === CODE.RESUME) return { type: 'event', event: 'resume' };
  }

  return null;
};

export const saveArtwork = (buffer, artworkDir) => {
  fs.mkdirSync(artworkDir, { recursive: true });

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const ext = isPng ? 'png' : 'jpg';
  const filename = `current.${ext}`;
  const filepath = path.join(artworkDir, filename);

  fs.writeFileSync(filepath, buffer);

  const other = path.join(artworkDir, isPng ? 'current.jpg' : 'current.png');
  if (fs.existsSync(other)) fs.unlinkSync(other);

  return `/artwork/${filename}`;
};

export const createPipeReader = (pipePath, onItem) => {
  let buffer = '';
  let stream = null;
  let reconnectTimer = null;

  const connect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    stream = fs.createReadStream(pipePath, { encoding: 'utf8' });
    buffer = '';

    stream.on('data', (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('</item>\n')) !== -1) {
        const xml = buffer.slice(0, end + 7);
        buffer = buffer.slice(end + 7);
        onItem(parseMetadataItem(xml));
      }
    });

    stream.on('error', (err) => {
      if (err.code === 'ENOENT' || err.code === 'ENXIO') {
        scheduleReconnect();
        return;
      }
      console.error(`metadata pipe error: ${err.message}`);
    });

    stream.on('close', scheduleReconnect);
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  };

  connect();

  return {
    destroy() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stream?.destroy();
    },
  };
};
