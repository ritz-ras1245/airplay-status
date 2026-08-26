import { getDeviceProfile } from '../lib/einkDeviceProfile.js';
import { buildEinkViewModel } from '../lib/einkDisplayMath.js';
import { touchClient } from '../lib/einkClientRegistry.js';
import { configureEinkDisplayService } from '../services/einkDisplayService.js';

const einkEnabled = () => process.env.EINK_ENABLED !== '0';

export const registerEinkRoutes = (app, {
  resolvePlayback,
  deployStage,
  onPlaybackChange,
  useMock,
}) => {
  if (!einkEnabled()) return null;

  const getPlaybackForEink = async (req) => {
    const { playback } = await resolvePlayback(req);
    return playback;
  };

  const einkService = configureEinkDisplayService({
    onPlaybackChange: useMock ? null : onPlaybackChange,
    getPlaybackState: getPlaybackForEink,
    airplayReceiverName: deployStage.airplayReceiverName,
  });

  app.get('/eink', async (req, res) => {
    const device = getDeviceProfile(req.query.device);
    touchClient(device.deviceId, 'html');

    const { playback } = await resolvePlayback(req);
    const showDebug = process.env.METADATA_DEBUG === '1' || req.query.debug === '1';
    const viewModel = buildEinkViewModel(playback, device, { showDebug });

    res.render('eink', {
      ...viewModel,
      airplayReceiverName: deployStage.airplayReceiverName,
    });
  });

  app.get('/kindle', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, `/eink${query}`);
  });

  const sendPng = async (req, res, deviceId) => {
    const result = await einkService.getPngResponse(deviceId, req);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('ETag', result.etag);
    if (result.status === 304) {
      res.status(304).end();
      return;
    }
    res.type(result.contentType).send(result.buffer);
  };

  app.get('/api/display/kindle.png', (req, res) => {
    sendPng(req, res, 'default').catch((err) => {
      console.error('[eink] PNG error', err);
      res.status(500).end();
    });
  });

  app.get('/api/display/:filename', (req, res) => {
    const match = String(req.params.filename).match(/^(.+)\.png$/i);
    if (!match) {
      res.status(404).end();
      return;
    }
    sendPng(req, res, match[1]).catch((err) => {
      console.error('[eink] PNG error', err);
      res.status(500).end();
    });
  });

  return einkService;
};
