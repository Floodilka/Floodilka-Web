const express = require('express');
const router = express.Router();

const config = require('../config/env');
const { authenticateToken } = require('../middleware/auth');

router.get('/config', authenticateToken, (req, res) => {
  const payload = {
    iceServers: config.voice.iceServers,
    iceTransportPolicy: config.voice.iceTransportPolicy,
    recording: {
      enabled: config.voice.recording.enabled,
      retentionDays: config.voice.recording.retentionDays
    }
  };

  res.json(payload);
});

module.exports = router;
