'use strict';
const express = require('express');
const db = require('../database');
const { authenticate, optionalAuth, checkDeptScope } = require('../middleware/auth');
const { processFeedback, generateDoctorReport } = require('../feedback-engine');
const router = express.Router();

// ─── PUBLIC: Submit feedback (optionalAuth — stores user_id if logged in) ──
router.post('/', optionalAuth, (req, res) => {
  const { doctor_id, raw_text, rating, patient_id } = req.body;
  if (!doctor_id || !raw_text) return res.status(400).json({ error: 'doctor_id and raw_text are required' });
  const doc = db.get('SELECT * FROM Doctors WHERE doctor_id=?', [doctor_id]);
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  const analysis = processFeedback(raw_text);
  const kwStr = JSON.stringify(analysis.keywords);
  const patientUserId = req.user ? req.user.user_id : null;
  const r = db.run(
    'INSERT INTO Feedback(doctor_id, patient_user_id, patient_id, raw_text, rating, sentiment_score, extracted_keywords) VALUES(?,?,?,?,?,?,?)',
    [doctor_id, patientUserId, patient_id || null, raw_text, rating || 3, analysis.sentimentScore, kwStr]
  );
  db.persist();
  res.json({
    feedback_id: r.lastInsertRowid,
    sentimentScore: analysis.sentimentScore,
    keywords: analysis.keywords,
    positiveTraits: analysis.positiveTraits,
    negativeTraits: analysis.negativeTraits,
    summary: analysis.summary
  });
});

// ─── Get feedback for a doctor (anonymized for doctor/hod/coordinator) ──
router.get('/doctor/:doctorId', authenticate, (req, res) => {
  const role = req.user.role;
  const doctorId = req.params.doctorId;

  // Doctor can only see own feedback
  if (role === 'doctor') {
    const doc = db.get('SELECT * FROM Doctors WHERE doctor_id=? AND user_id=?', [doctorId, req.user.user_id]);
    if (!doc) return res.status(403).json({ error: 'Can only view own feedback' });
  }

  // HoD/Coordinator: dept-scoped
  if (['hod', 'coordinator'].includes(role)) {
    const doc = db.get('SELECT dept_id FROM Doctors WHERE doctor_id=?', [doctorId]);
    if (!doc || !checkDeptScope(req, res, doc.dept_id)) return;
  }

  // Anonymized query for doctor/hod/coordinator — NO patient identity
  if (['doctor', 'hod', 'coordinator'].includes(role)) {
    const feedback = db.all(`
      SELECT f.feedback_id, f.raw_text, f.rating, f.sentiment_score,
             f.extracted_keywords, f.created_at
      FROM Feedback f WHERE f.doctor_id = ? ORDER BY f.created_at DESC
    `, [doctorId]);
    feedback.forEach(f => {
      try { f.extracted_keywords = JSON.parse(f.extracted_keywords); } catch { f.extracted_keywords = []; }
    });
    return res.json(feedback);
  }

  // Admin/receptionist: full data with patient name
  const feedback = db.all(`
    SELECT f.*, u.full_name AS patient_name
    FROM Feedback f LEFT JOIN Users u ON f.patient_user_id = u.user_id
    WHERE f.doctor_id = ? ORDER BY f.created_at DESC
  `, [doctorId]);
  feedback.forEach(f => {
    try { f.extracted_keywords = JSON.parse(f.extracted_keywords); } catch { f.extracted_keywords = []; }
  });
  res.json(feedback);
});

// ─── Generated report for a doctor ────────────────────────
router.get('/doctor/:doctorId/report', authenticate, (req, res) => {
  const role = req.user.role;
  const doctorId = req.params.doctorId;

  // Doctor: own only
  if (role === 'doctor') {
    const doc = db.get('SELECT * FROM Doctors WHERE doctor_id=? AND user_id=?', [doctorId, req.user.user_id]);
    if (!doc) return res.status(403).json({ error: 'Can only view own report' });
  }
  // HoD/Coordinator: dept-scoped
  if (['hod', 'coordinator'].includes(role)) {
    const doc = db.get('SELECT dept_id FROM Doctors WHERE doctor_id=?', [doctorId]);
    if (!doc || !checkDeptScope(req, res, doc.dept_id)) return;
  }
  if (!['admin', 'doctor', 'hod', 'coordinator', 'receptionist'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const rows = db.all('SELECT * FROM Feedback WHERE doctor_id=?', [doctorId]);
  const report = generateDoctorReport(rows);
  const doc = db.get(`SELECT d.*, u.full_name, dep.dept_name FROM Doctors d
    JOIN Users u ON d.user_id = u.user_id JOIN Departments dep ON d.dept_id = dep.dept_id
    WHERE d.doctor_id = ?`, [doctorId]);
  res.json({ doctor: doc, ...report });
});

// ─── Aggregated summary (admin, hod/coord dept-scoped, receptionist) ──
router.get('/summary', authenticate, (req, res) => {
  const role = req.user.role;
  if (!['admin', 'hod', 'coordinator', 'receptionist', 'doctor'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let sql = `SELECT d.doctor_id, d.specialization, d.designation, d.dept_id,
    u.full_name, dep.dept_name, dep.dept_code
    FROM Doctors d JOIN Users u ON d.user_id = u.user_id
    JOIN Departments dep ON d.dept_id = dep.dept_id`;
  const params = [];

  // HoD/Coordinator: only their department
  if (['hod', 'coordinator'].includes(role)) {
    sql += ' WHERE d.dept_id = ?';
    params.push(req.user.dept_id);
  }
  // Doctor: only own
  if (role === 'doctor') {
    sql += ' WHERE d.user_id = ?';
    params.push(req.user.user_id);
  }

  sql += ' ORDER BY dep.dept_name, u.full_name';
  const doctors = db.all(sql, params);

  const summaries = doctors.map(doc => {
    const stats = db.get('SELECT COUNT(*) as total, AVG(sentiment_score) as avg_score, AVG(rating) as avg_rating FROM Feedback WHERE doctor_id=?', [doc.doctor_id]);
    return {
      ...doc,
      total_reviews: stats?.total || 0,
      average_score: stats?.avg_score ? Math.round(stats.avg_score) : null,
      average_rating: stats?.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null,
    };
  });
  res.json(summaries);
});

module.exports = router;
