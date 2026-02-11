// server.js
// Express server для Megaplan Expenses Application

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================
// MIDDLEWARE
// ===========================

// CORS
app.use(cors());

// JSON parsing
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname)));

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ===========================
// API ROUTES
// ===========================

// Import API handlers
const expensesHandler = require('./api/expenses');
const exportHandler = require('./api/export');

// API endpoints
app.get('/api/expenses', expensesHandler);
app.get('/api/export', exportHandler);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      megaplanAccount: process.env.MEGAPLAN_ACCOUNT || 'not configured',
      hasLogin: !!process.env.MEGAPLAN_LOGIN,
      hasPassword: !!process.env.MEGAPLAN_PASSWORD
    }
  });
});

// ===========================
// STATIC ROUTES
// ===========================

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===========================
// ERROR HANDLING
// ===========================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.url 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ===========================
// START SERVER
// ===========================

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Megaplan Expenses Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server:     http://localhost:${PORT}`);
  console.log(`📊 Frontend:   http://localhost:${PORT}/`);
  console.log(`🔌 API:        http://localhost:${PORT}/api/expenses`);
  console.log(`📥 Export:     http://localhost:${PORT}/api/export`);
  console.log(`💚 Health:     http://localhost:${PORT}/api/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Check configuration
  if (!process.env.MEGAPLAN_ACCOUNT || !process.env.MEGAPLAN_LOGIN || !process.env.MEGAPLAN_PASSWORD) {
    console.warn('⚠️  WARNING: Megaplan credentials not configured!');
    console.warn('   Please create .env file with:');
    console.warn('   - MEGAPLAN_ACCOUNT');
    console.warn('   - MEGAPLAN_LOGIN');
    console.warn('   - MEGAPLAN_PASSWORD');
    console.warn('');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
