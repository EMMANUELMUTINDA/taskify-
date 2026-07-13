const { app, initializeApp } = require('../server/app');

let ready;

module.exports = async (req, res) => {
  try {
    if (!ready) {
      ready = initializeApp();
    }

    await ready;
    return app(req, res);
  } catch (error) {
    console.error('Failed to initialize API handler.', error.message);
    return res.status(500).json({ message: 'Server initialization failed' });
  }
};