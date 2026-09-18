/** Decode shairport-sync ssnc DACP / client IP payloads. */

export const decodeTextOrHex = (data) => {
  if (!data || !data.length) return null;
  const asUtf8 = data.toString('utf8').replace(/\0/g, '').trim();
  if (asUtf8 && /^[\x20-\x7e]+$/.test(asUtf8)) return asUtf8;
  return data.toString('hex').toUpperCase();
};

export const decodePort = (data) => {
  if (!data || !data.length) return null;
  if (data.length >= 4) return data.readUInt32BE(0);
  if (data.length >= 2) return data.readUInt16BE(0);
  const n = Number(data.toString('utf8').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};
