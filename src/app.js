const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const { runPostgresMigrations } = require('./config/migratePostgres');
const { checkPostgresHealth } = require('./config/postgres');
const { checkRedisHealth } = require('./config/redis');
const { optionalAuthMiddleware } = require('./middlewares/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const medicinesRoutes = require('./routes/medicinesRoutes');
const salesRoutes = require('./routes/salesRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const auditRoutes = require('./routes/auditRoutes');

// Execute DB migrations & default account seeding asynchronously
runPostgresMigrations().catch(err => {
  console.error('[app initialization] Migration runner error:', err.message);
});

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(optionalAuthMiddleware);

// Serve static frontend
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/medicines', uploadRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditRoutes);

// Health check endpoint with PostgreSQL & Redis status reporting
app.get('/api/health', async (req, res) => {
  const pgHealthy = await checkPostgresHealth();
  const redisHealthy = await checkRedisHealth();

  let overallStatus = 'ok';
  if (!pgHealthy) {
    overallStatus = 'error';
  } else if (!redisHealthy) {
    overallStatus = 'degraded';
  }

  const statusCode = pgHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: overallStatus,
    database: pgHealthy ? 'connected' : 'disconnected',
    redis: redisHealthy ? 'connected' : 'degraded',
    timestamp: new Date().toISOString()
  });
});

// Fallback - send index.html for SPA
app.get('*', (req, res) => {
  const index = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send('Not found');
});

module.exports = app;
