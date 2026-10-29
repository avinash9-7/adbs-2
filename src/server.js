require('dotenv').config();
const path = require('path');
const express = require('express');
const { connectMongo, closeMongo } = require('./db/mongo');
const api = require('./routes/api');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.use('/api', (req, res, next) => {
  if (!req.app.locals.db) return res.status(503).json({ error: 'Database is not connected yet. Check server configuration.' });
  next();
}, api);
app.get('/api/*', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong while processing the request.' });
});

const port = Number(process.env.PORT) || 3000;
async function start() {
  try {
    app.locals.db = await connectMongo();
    app.listen(port, '0.0.0.0', () => console.log(`Fieldnote is ready on port ${port}`));
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}
async function shutdown() {
  await closeMongo();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
start();
