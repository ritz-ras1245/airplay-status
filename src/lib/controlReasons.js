/** User-facing copy for DACP / transport availability. */

export const CONTROL_REASON_COPY = {
  no_session: 'Select AirPlay Status as an output to enable transport controls.',
  dacp_probe_failed: 'Remote control is unavailable for this session (DACP probe failed).',
  ios_blocked: 'Your iPhone may ignore remote commands on iOS 17.4+ even when buttons send.',
  ap2_unsupported:
    'This session looks like AirPlay 2. Native iPhone/iPad Now Playing uses MRP, which this receiver does not implement. Play/pause from this dashboard needs a Classic AirPlay (DACP) session — typically Mac Music, not an AP2 HomePod group.',
  mock_mode: 'Mock dashboard — commands update local preview only, not a real sender.',
  control_unavailable: 'Transport controls are not available right now.',
};

export const controlReasonMessage = (reason) =>
  CONTROL_REASON_COPY[reason] ?? CONTROL_REASON_COPY.control_unavailable;
