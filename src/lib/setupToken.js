import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN_FILE = path.join(projectRoot, '.setup-token');

export const getSetupTokenPath = () => TOKEN_FILE;

export const readSetupToken = () => {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
};

export const clearSetupToken = () => {
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {
    /* already gone */
  }
};

export const validateSetupToken = (provided) => {
  const expected = readSetupToken();
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
