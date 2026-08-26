/**
 * Media Status board: holds focus, rotates among sources with a track, pins on demand.
 * Clock and source list are injected so tests do not need timers.
 */

import {
  DEFAULT_PIN_MS,
  DEFAULT_ROTATE_MS,
  PRODUCT_NAME,
  SOURCE_DEFS,
  emptyPlayback,
  nextFocusId,
  resolveFocus,
  sourceLabel,
  visibleSourceIds,
  withSourceId,
} from '../lib/sourceRotate.js';

/**
 * @param {{
 *   listSources: () => Record<string, object>,
 *   enabledIds?: string[],
 *   rotateMs?: number,
 *   pinMs?: number,
 *   now?: () => number,
 * }} opts
 */
export const createSourceDisplayService = ({
  listSources,
  enabledIds = ['airplay'],
  rotateMs = DEFAULT_ROTATE_MS,
  pinMs = DEFAULT_PIN_MS,
  now = () => Date.now(),
}) => {
  const ids = enabledIds.length ? [...enabledIds] : ['airplay'];
  let focusedId = ids[0];
  let pinnedId = null;
  let pinUntilMs = 0;
  let lastAdvanceMs = now();
  let pinWasActive = false;
  let timer = null;
  const listeners = new Set();

  const emit = (board) => {
    for (const fn of listeners) fn(board);
  };

  const isPinActive = (visible, nowMs) =>
    Boolean(pinnedId) && nowMs < pinUntilMs && visible.includes(pinnedId);

  const getBoard = () => {
    const sourcesById = listSources() || {};
    const nowMs = now();
    const visible = visibleSourceIds(sourcesById, ids);
    const pinActive = isPinActive(visible, nowMs);
    const focus =
      resolveFocus({
        visibleIds: visible,
        currentId: focusedId,
        pinnedId,
        nowMs,
        pinUntilMs,
      }) || ids[0];
    focusedId = focus;

    const sources = ids.map((id) => {
      const raw = sourcesById[id] || emptyPlayback(id);
      const playback = withSourceId(raw, id);
      return {
        id,
        label: sourceLabel(id),
        hasTrack: Boolean(playback.title),
        playback,
      };
    });

    const focused =
      sources.find((s) => s.id === focusedId)?.playback || emptyPlayback(focusedId);

    return {
      productName: ids.length > 1 ? PRODUCT_NAME : null,
      focusedId,
      focused,
      rotateMs,
      rotating: visible.length > 1 && !pinActive,
      pinned: pinActive,
      sources,
    };
  };

  const tick = () => {
    const before = focusedId;
    const sourcesById = listSources() || {};
    const nowMs = now();
    const visible = visibleSourceIds(sourcesById, ids);
    const pinActive = isPinActive(visible, nowMs);

    if (pinWasActive && !pinActive) {
      lastAdvanceMs = nowMs;
    }
    pinWasActive = pinActive;

    if (pinActive) {
      focusedId = pinnedId;
    } else if (visible.length > 1 && nowMs - lastAdvanceMs >= rotateMs) {
      focusedId = nextFocusId(visible, focusedId);
      lastAdvanceMs = nowMs;
    } else {
      focusedId =
        resolveFocus({
          visibleIds: visible,
          currentId: focusedId,
          pinnedId,
          nowMs,
          pinUntilMs,
        }) || ids[0];
    }

    if (focusedId !== before) emit(getBoard());
  };

  const pin = (sourceId) => {
    if (!ids.includes(sourceId)) return false;
    pinnedId = sourceId;
    focusedId = sourceId;
    pinUntilMs = now() + pinMs;
    lastAdvanceMs = now();
    pinWasActive = true;
    emit(getBoard());
    return true;
  };

  const getFocused = () => getBoard().focused;

  const start = (intervalMs = 250) => {
    if (timer) return;
    lastAdvanceMs = now();
    timer = setInterval(tick, intervalMs);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const onFocusChange = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return {
    getBoard,
    getFocused,
    tick,
    pin,
    start,
    stop,
    onFocusChange,
    enabledIds: ids,
    defs: SOURCE_DEFS.filter((d) => ids.includes(d.id)),
  };
};
