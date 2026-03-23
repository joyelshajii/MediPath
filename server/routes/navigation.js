'use strict';
const express = require('express');
const db = require('../database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// ─── Dijkstra's Shortest Path ─────────────────────────────
function dijkstra(nodes, edges, startId, endId) {
  const adj = {};
  nodes.forEach(n => { adj[n.node_id] = []; });
  edges.forEach(e => {
    if (adj[e.from_node_id]) adj[e.from_node_id].push({ to: e.to_node_id, dist: e.distance });
  });
  const dist = {}, prev = {}, visited = new Set();
  nodes.forEach(n => { dist[n.node_id] = Infinity; });
  dist[startId] = 0;
  const pq = [{ id: startId, d: 0 }];
  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const { id: current, d: currentDist } = pq.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === endId) break;
    if (!adj[current]) continue;
    for (const nb of adj[current]) {
      if (visited.has(nb.to)) continue;
      const nd = currentDist + nb.dist;
      if (nd < dist[nb.to]) { dist[nb.to] = nd; prev[nb.to] = current; pq.push({ id: nb.to, d: nd }); }
    }
  }
  if (dist[endId] === Infinity) return null;
  const path = [];
  let cur = endId;
  while (cur !== undefined) { path.unshift(cur); cur = prev[cur]; }
  return { path, totalDistance: Math.round(dist[endId] * 10) / 10, nodeCount: path.length };
}

// ─── PUBLIC: Get all nodes ────────────────────────────────
router.get('/nodes', (_req, res) => {
  res.json(db.all('SELECT * FROM Nodes ORDER BY floor, label'));
});

// ─── PUBLIC: Get all edges ────────────────────────────────
router.get('/edges', (_req, res) => {
  res.json(db.all('SELECT * FROM Edges ORDER BY edge_id'));
});

// ─── PUBLIC: Calculate shortest route ─────────────────────
router.get('/route', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Both "from" and "to" node IDs are required' });
  const fromId = parseInt(from), toId = parseInt(to);
  const fromNode = db.get('SELECT * FROM Nodes WHERE node_id=?', [fromId]);
  const toNode = db.get('SELECT * FROM Nodes WHERE node_id=?', [toId]);
  if (!fromNode) return res.status(404).json({ error: `Origin node ${fromId} not found` });
  if (!toNode) return res.status(404).json({ error: `Destination node ${toId} not found` });
  const nodes = db.all('SELECT * FROM Nodes');
  const edges = db.all('SELECT * FROM Edges');
  const result = dijkstra(nodes, edges, fromId, toId);
  if (!result) return res.status(404).json({ error: 'No path found between the specified nodes' });
  const pathDetails = result.path.map(id => db.get('SELECT * FROM Nodes WHERE node_id=?', [id]));
  const directions = [];
  for (let i = 0; i < pathDetails.length; i++) {
    const node = pathDetails[i], prev = i > 0 ? pathDetails[i - 1] : null;
    if (i === 0) {
      directions.push({ step: 1, instruction: `Start at: ${node.label}`, node_id: node.node_id, floor: node.floor });
    } else if (node.floor !== prev.floor) {
      const dir = node.node_type === 'elevator' ? 'Take elevator' : 'Use stairs';
      directions.push({ step: directions.length + 1, instruction: `${dir} to ${node.floor} Floor`, node_id: node.node_id, floor: node.floor, floorChange: true });
    } else if (node.node_type === 'room') {
      directions.push({ step: directions.length + 1, instruction: `Arrive at: ${node.label}`, node_id: node.node_id, floor: node.floor, isDestination: i === pathDetails.length - 1 });
    } else if (node.node_type === 'corridor') {
      directions.push({ step: directions.length + 1, instruction: `Continue through ${node.label}`, node_id: node.node_id, floor: node.floor });
    } else {
      directions.push({ step: directions.length + 1, instruction: `Pass through ${node.label}`, node_id: node.node_id, floor: node.floor });
    }
  }
  res.json({ from: fromNode, to: toNode, path: result.path, pathDetails, totalDistance: result.totalDistance, directions, estimatedTime: `${Math.ceil(result.totalDistance * 0.5)} min` });
});

// ─── PUBLIC: Resolve QR code ──────────────────────────────
router.get('/qr/:code', (req, res) => {
  const node = db.get('SELECT * FROM Nodes WHERE qr_code=?', [req.params.code]);
  if (!node) return res.status(404).json({ error: 'QR code not recognized' });
  res.json(node);
});

// ─── PUBLIC: Get all rooms ────────────────────────────────
router.get('/rooms', (_req, res) => {
  res.json(db.all("SELECT * FROM Nodes WHERE node_type = 'room' ORDER BY floor, label"));
});

// ─── Admin/HoD/Coordinator: CRUD nodes ───────────────────────────────
router.post('/nodes', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { x, y, floor, node_type, label, qr_code } = req.body;
  const r = db.run('INSERT INTO Nodes(facility_id,x,y,floor,node_type,label,qr_code) VALUES(1,?,?,?,?,?,?)',
    [x, y, floor, node_type, label, qr_code || null]);
  db.persist();
  res.json({ node_id: r.lastInsertRowid });
});

router.put('/nodes/:id', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { x, y, floor, node_type, label, qr_code } = req.body;
  db.run('UPDATE Nodes SET x=?, y=?, floor=?, node_type=?, label=?, qr_code=? WHERE node_id=?',
    [x, y, floor, node_type, label, qr_code || null, req.params.id]);
  db.persist();
  res.json({ success: true });
});

router.delete('/nodes/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.run('DELETE FROM Edges WHERE from_node_id=? OR to_node_id=?', [req.params.id, req.params.id]);
  db.run('DELETE FROM Nodes WHERE node_id=?', [req.params.id]);
  db.persist();
  res.json({ success: true });
});

module.exports = router;
