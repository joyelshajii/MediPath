'use strict';
const express = require('express');
const db = require('../database');
const { authenticate, checkDeptScope } = require('../middleware/auth');
const router = express.Router();

let _broadcast = null;
router.setBroadcast = (fn) => { _broadcast = fn; };

// ─── PUBLIC: Get all doctors with status & location ───────
router.get('/', (_req, res) => {
  res.json(db.all(`
    SELECT d.doctor_id, d.specialization, d.designation, d.status, d.phone, d.consultation_fee,
           d.current_node_id, u.user_id, u.full_name, u.email, u.is_active, u.username,
           dep.dept_id, dep.dept_name, dep.dept_code,
           n.label AS current_room, n.floor AS current_floor, n.node_type
    FROM Doctors d JOIN Users u ON d.user_id = u.user_id
    JOIN Departments dep ON d.dept_id = dep.dept_id
    LEFT JOIN Nodes n ON d.current_node_id = n.node_id
    WHERE u.is_active = 1 ORDER BY dep.dept_name, u.full_name
  `));
});

// ─── PUBLIC: Get single doctor ────────────────────────────
router.get('/me/profile', authenticate, (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Not a doctor' });
  const doc = db.get(`SELECT d.*, dep.dept_name, dep.dept_code, n.label AS current_room
    FROM Doctors d JOIN Departments dep ON d.dept_id = dep.dept_id
    LEFT JOIN Nodes n ON d.current_node_id = n.node_id WHERE d.user_id = ?`, [req.user.user_id]);
  if (!doc) return res.status(404).json({ error: 'No doctor profile linked' });
  res.json(doc);
});

// ─── PUBLIC: Get doctors by department ────────────────────
router.get('/department/:deptId', (_req, res) => {
  res.json(db.all(`SELECT d.doctor_id, d.specialization, d.designation, d.status, d.phone,
    d.current_node_id, d.consultation_fee, u.full_name, u.email, u.is_active,
    n.label AS current_room, n.floor AS current_floor
    FROM Doctors d JOIN Users u ON d.user_id = u.user_id
    LEFT JOIN Nodes n ON d.current_node_id = n.node_id
    WHERE d.dept_id = ? AND u.is_active = 1 ORDER BY u.full_name`, [_req.params.deptId]));
});

// ─── PUBLIC: Get single doctor detail ─────────────────────
router.get('/:id', (req, res) => {
  const doc = db.get(`SELECT d.*, u.full_name, u.email, u.username, u.is_active,
    dep.dept_name, dep.dept_code, n.label AS current_room, n.floor AS current_floor
    FROM Doctors d JOIN Users u ON d.user_id = u.user_id
    JOIN Departments dep ON d.dept_id = dep.dept_id
    LEFT JOIN Nodes n ON d.current_node_id = n.node_id WHERE d.doctor_id = ?`, [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  const stats = db.get('SELECT COUNT(*) as cnt, AVG(sentiment_score) as avg_score FROM Feedback WHERE doctor_id=?', [req.params.id]);
  doc.feedback_count = stats?.cnt || 0;
  doc.average_score = stats?.avg_score ? Math.round(stats.avg_score) : null;
  res.json(doc);
});

// ─── Update doctor status (admin, doctor-own, hod/coord dept-scoped) ──
router.put('/:id/status', authenticate, (req, res) => {
  const { role } = req.user;
  if (!['admin', 'doctor', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  const doc = db.get('SELECT * FROM Doctors WHERE doctor_id=?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  if (role === 'doctor' && doc.user_id !== req.user.user_id) return res.status(403).json({ error: 'Can only update own status' });
  if (['hod', 'coordinator'].includes(role) && !checkDeptScope(req, res, doc.dept_id)) return;

  const { status, current_node_id } = req.body;
  const validStatuses = ['available', 'busy', 'in_surgery', 'off_duty', 'on_break'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
  if (status) db.run('UPDATE Doctors SET status=? WHERE doctor_id=?', [status, req.params.id]);
  if (current_node_id !== undefined) {
    if (current_node_id !== null) {
      const node = db.get('SELECT * FROM Nodes WHERE node_id=?', [current_node_id]);
      if (!node) return res.status(400).json({ error: 'Invalid node ID' });
    }
    db.run('UPDATE Doctors SET current_node_id=? WHERE doctor_id=?', [current_node_id, req.params.id]);
  }
  db.persist();
  if (_broadcast) {
    const updated = db.get(`SELECT d.doctor_id, d.status, d.current_node_id, u.full_name, n.label AS current_room
      FROM Doctors d JOIN Users u ON d.user_id = u.user_id LEFT JOIN Nodes n ON d.current_node_id = n.node_id
      WHERE d.doctor_id = ?`, [req.params.id]);
    _broadcast({ type: 'doctor_status', data: updated });
  }
  res.json({ success: true });
});

// ─── Admin/HoD/Coordinator: update doctor info ───────────
router.put('/:id', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const doc = db.get('SELECT * FROM Doctors WHERE doctor_id=?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  if (['hod', 'coordinator'].includes(req.user.role) && !checkDeptScope(req, res, doc.dept_id)) return;
  const { specialization, designation, phone, consultation_fee, dept_id } = req.body;
  if (specialization) db.run('UPDATE Doctors SET specialization=? WHERE doctor_id=?', [specialization, req.params.id]);
  if (designation) db.run('UPDATE Doctors SET designation=? WHERE doctor_id=?', [designation, req.params.id]);
  if (phone) db.run('UPDATE Doctors SET phone=? WHERE doctor_id=?', [phone, req.params.id]);
  if (consultation_fee) db.run('UPDATE Doctors SET consultation_fee=? WHERE doctor_id=?', [consultation_fee, req.params.id]);
  if (dept_id && req.user.role === 'admin') db.run('UPDATE Doctors SET dept_id=? WHERE doctor_id=?', [dept_id, req.params.id]);
  db.persist();
  res.json({ success: true });
});

module.exports = router;
