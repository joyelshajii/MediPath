'use strict';
const express = require('express');
const db = require('../database');
const { authenticate, checkDeptScope } = require('../middleware/auth');
const router = express.Router();

// ─── My Schedules (Doctor/Nurse — own) ────────────────────
router.get('/my', authenticate, (req, res) => {
  if (!['doctor', 'nurse'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  res.json(db.all('SELECT * FROM Schedules WHERE user_id=? ORDER BY start_time', [req.user.user_id]));
});

// ─── Get schedules for a user (HoD/Coordinator dept-scoped, Admin) ──
router.get('/user/:userId', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const target = db.get('SELECT * FROM Users WHERE user_id=?', [req.params.userId]);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (['hod', 'coordinator'].includes(req.user.role) && !checkDeptScope(req, res, target.dept_id)) return;
  res.json(db.all('SELECT * FROM Schedules WHERE user_id=? ORDER BY start_time', [req.params.userId]));
});

// ─── Get schedules for a department (HoD/Coord own dept, Admin any) ──
router.get('/department/:deptId', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  if (['hod', 'coordinator'].includes(req.user.role) && !checkDeptScope(req, res, req.params.deptId)) return;
  const schedules = db.all(`
    SELECT s.*, u.full_name, r.role_name AS role
    FROM Schedules s JOIN Users u ON s.user_id = u.user_id
    JOIN Roles r ON u.role_id = r.role_id
    WHERE u.dept_id = ? ORDER BY s.start_time
  `, [req.params.deptId]);
  res.json(schedules);
});

// ─── Create schedule ──────────────────────────────────────
router.post('/', authenticate, (req, res) => {
  const { role } = req.user;
  const { user_id, title, schedule_type, start_time, end_time, notes } = req.body;
  if (!title || !start_time || !end_time) return res.status(400).json({ error: 'title, start_time, end_time required' });

  // Determine target user
  let targetUserId = user_id;
  if (['doctor', 'nurse'].includes(role)) {
    targetUserId = req.user.user_id; // can only create for self
  } else if (['hod', 'coordinator'].includes(role)) {
    if (!targetUserId) return res.status(400).json({ error: 'user_id required' });
    const target = db.get('SELECT * FROM Users WHERE user_id=?', [targetUserId]);
    if (!target || !checkDeptScope(req, res, target.dept_id)) return;
  } else if (role === 'admin') {
    if (!targetUserId) targetUserId = req.user.user_id;
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const r = db.run('INSERT INTO Schedules(user_id,title,schedule_type,start_time,end_time,notes) VALUES(?,?,?,?,?,?)',
    [targetUserId, title, schedule_type || 'appointment', start_time, end_time, notes || null]);
  db.persist();
  res.json({ schedule_id: r.lastInsertRowid, success: true });
});

// ─── Update schedule ──────────────────────────────────────
router.put('/:id', authenticate, (req, res) => {
  const sched = db.get('SELECT * FROM Schedules WHERE schedule_id=?', [req.params.id]);
  if (!sched) return res.status(404).json({ error: 'Schedule not found' });

  const { role } = req.user;
  // Owner can always edit
  if (sched.user_id !== req.user.user_id) {
    if (!['admin', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    if (['hod', 'coordinator'].includes(role)) {
      const target = db.get('SELECT * FROM Users WHERE user_id=?', [sched.user_id]);
      if (!target || !checkDeptScope(req, res, target.dept_id)) return;
    }
  }

  const { title, schedule_type, start_time, end_time, notes } = req.body;
  if (title) db.run('UPDATE Schedules SET title=? WHERE schedule_id=?', [title, req.params.id]);
  if (schedule_type) db.run('UPDATE Schedules SET schedule_type=? WHERE schedule_id=?', [schedule_type, req.params.id]);
  if (start_time) db.run('UPDATE Schedules SET start_time=? WHERE schedule_id=?', [start_time, req.params.id]);
  if (end_time) db.run('UPDATE Schedules SET end_time=? WHERE schedule_id=?', [end_time, req.params.id]);
  if (notes !== undefined) db.run('UPDATE Schedules SET notes=? WHERE schedule_id=?', [notes, req.params.id]);
  db.persist();
  res.json({ success: true });
});

// ─── Delete schedule ──────────────────────────────────────
router.delete('/:id', authenticate, (req, res) => {
  const sched = db.get('SELECT * FROM Schedules WHERE schedule_id=?', [req.params.id]);
  if (!sched) return res.status(404).json({ error: 'Schedule not found' });
  const { role } = req.user;
  if (sched.user_id !== req.user.user_id) {
    if (!['admin', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    if (['hod', 'coordinator'].includes(role)) {
      const target = db.get('SELECT * FROM Users WHERE user_id=?', [sched.user_id]);
      if (!target || !checkDeptScope(req, res, target.dept_id)) return;
    }
  }
  db.run('DELETE FROM Schedules WHERE schedule_id=?', [req.params.id]);
  db.persist();
  res.json({ success: true });
});

// ─── Nurse Allocations ────────────────────────────────────
// Nurse: view own allocations
router.get('/nurse/allocations', authenticate, (req, res) => {
  const { role } = req.user;
  if (role === 'nurse') {
    const allocs = db.all(`
      SELECT na.*, u.full_name AS doctor_name, d.specialization
      FROM NurseAllocations na
      JOIN Doctors d ON na.doctor_id = d.doctor_id
      JOIN Users u ON d.user_id = u.user_id
      WHERE na.nurse_user_id = ? ORDER BY na.duty_date DESC
    `, [req.user.user_id]);
    return res.json(allocs);
  }
  // HoD/Coordinator: dept-scoped
  if (['hod', 'coordinator'].includes(role)) {
    const allocs = db.all(`
      SELECT na.*, nu.full_name AS nurse_name, du.full_name AS doctor_name, d.specialization, nu.dept_id
      FROM NurseAllocations na
      JOIN Users nu ON na.nurse_user_id = nu.user_id
      JOIN Doctors d ON na.doctor_id = d.doctor_id
      JOIN Users du ON d.user_id = du.user_id
      WHERE nu.dept_id = ? ORDER BY na.duty_date DESC
    `, [req.user.dept_id]);
    return res.json(allocs);
  }
  // Admin: all
  if (role === 'admin') {
    return res.json(db.all(`
      SELECT na.*, nu.full_name AS nurse_name, du.full_name AS doctor_name, d.specialization
      FROM NurseAllocations na
      JOIN Users nu ON na.nurse_user_id = nu.user_id
      JOIN Doctors d ON na.doctor_id = d.doctor_id
      JOIN Users du ON d.user_id = du.user_id
      ORDER BY na.duty_date DESC
    `));
  }
  res.status(403).json({ error: 'Forbidden' });
});

// Create nurse allocation (HoD/Coordinator dept-scoped, Admin)
router.post('/nurse/allocations', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { nurse_user_id, doctor_id, duty_date, shift, notes } = req.body;
  if (!nurse_user_id || !doctor_id || !duty_date) return res.status(400).json({ error: 'nurse_user_id, doctor_id, duty_date required' });

  if (['hod', 'coordinator'].includes(req.user.role)) {
    const nurse = db.get('SELECT * FROM Users WHERE user_id=?', [nurse_user_id]);
    if (!nurse || !checkDeptScope(req, res, nurse.dept_id)) return;
  }

  const r = db.run('INSERT INTO NurseAllocations(nurse_user_id,doctor_id,duty_date,shift,notes) VALUES(?,?,?,?,?)',
    [nurse_user_id, doctor_id, duty_date, shift || 'day', notes || null]);
  db.persist();
  res.json({ allocation_id: r.lastInsertRowid, success: true });
});

// Delete nurse allocation
router.delete('/nurse/allocations/:id', authenticate, (req, res) => {
  if (!['admin', 'hod', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  db.run('DELETE FROM NurseAllocations WHERE allocation_id=?', [req.params.id]);
  db.persist();
  res.json({ success: true });
});

module.exports = router;
