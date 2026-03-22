'use strict';
const express = require('express');
const db = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// PUBLIC: list departments
router.get('/', (_req, res) => res.json(db.all('SELECT * FROM Departments ORDER BY dept_name')));

router.post('/', authenticate, authorize('admin'), (req, res) => {
    const { dept_name, dept_code, floor } = req.body;
    if (!dept_name || !dept_code) return res.status(400).json({ error: 'dept_name and dept_code required' });
    try {
        const r = db.run('INSERT INTO Departments(facility_id,dept_name,dept_code,floor) VALUES(1,?,?,?)', [dept_name, dept_code, floor || null]);
        db.persist();
        res.json({ dept_id: r.lastInsertRowid });
    } catch (e) { res.status(400).json({ error: 'Department name or code already exists' }); }
});

router.put('/:id', authenticate, authorize('admin'), (req, res) => {
    const { dept_name, dept_code, floor } = req.body;
    if (dept_name) db.run('UPDATE Departments SET dept_name=? WHERE dept_id=?', [dept_name, req.params.id]);
    if (dept_code) db.run('UPDATE Departments SET dept_code=? WHERE dept_id=?', [dept_code, req.params.id]);
    if (floor !== undefined) db.run('UPDATE Departments SET floor=? WHERE dept_id=?', [floor, req.params.id]);
    db.persist();
    res.json({ success: true });
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
    db.run('DELETE FROM Departments WHERE dept_id=?', [req.params.id]);
    db.persist();
    res.json({ success: true });
});

module.exports = router;
