require('dotenv').config();
const { app, initializeApp } = require('./app');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initializeApp();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server because database connection was not established.');
    console.error(error.message);
    process.exit(1);
  }
};

startServer();