'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const db = require('./database');

const authRoutes = require('./routes/auth');
const navigationRoutes = require('./routes/navigation');
const doctorsRoutes = require('./routes/doctors');
const feedbackRoutes = require('./routes/feedback');
const usersRoutes = require('./routes/users');
const departmentsRoutes = require('./routes/departments');
const schedulesRoutes = require('./routes/schedules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ───────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/schedules', schedulesRoutes);

// Utility endpoint for roles
app.get('/api/utils/roles', (req, res) => {
  res.json(db.all('SELECT * FROM Roles'));
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ─── Start Server with WebSocket ──────────────────────────
db.ready.then(() => {
  const server = http.createServer(app);

  // WebSocket server for real-time doctor status updates
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (total: ${clients.size})`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on('error', () => clients.delete(ws));
  });

  // Broadcast function for doctor status changes
  function broadcast(message) {
    const data = JSON.stringify(message);
    clients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(data);
      }
    });
  }

  // Wire broadcast to routes
  doctorsRoutes.setBroadcast(broadcast);
  schedulesRoutes.setBroadcast(broadcast);

  server.listen(PORT, () => {
    console.log(`\nMediPath running at http://localhost:${PORT}\n`);
    console.log('Hospital: St. Joseph\'s Mission Hospital');
    console.log('\nDemo logins:');
    console.log('  Admin:        admin / admin123');
    console.log('  HoD (Med):    hod.med / hod123');
    console.log('  Coord (Med):  coord.med / coord123');
    console.log('  Doctor:       dr.kumar / doc123');
    console.log('  Receptionist: reception1 / rec123');
    console.log('  Patient:      patient1 / pat123');
    console.log('  Nurse:        nurse.susan / nurse123\n');
  });
});
