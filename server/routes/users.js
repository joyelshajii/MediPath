'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticate, checkDeptScope } = require('../middleware/auth');
const router = express.Router();

// GET /users — Admin sees all, HoD/Coordinator see own dept only
router.get('/', authenticate, (req, res) => {
    const { role } = req.user;
    if (!['admin', 'hod', 'coordinator', 'receptionist'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const { role_filter, dept_id: deptFilter } = req.query;
    let sql = `SELECT u.user_id, u.username, u.full_name, u.email, u.is_active,
             r.role_name AS role, d.dept_name, d.dept_code, d.dept_id
             FROM Users u JOIN Roles r ON u.role_id = r.role_id
             LEFT JOIN Departments d ON u.dept_id = d.dept_id WHERE 1=1`;
    const params = [];

    // HoD/Coordinator: enforce dept scope
    if (['hod', 'coordinator'].includes(role)) {
        sql += ' AND u.dept_id = ?'; params.push(req.user.dept_id);
    } else if (deptFilter) {
        sql += ' AND u.dept_id = ?'; params.push(deptFilter);
    }
    if (role_filter) { sql += ' AND r.role_name = ?'; params.push(role_filter); }
    sql += ' ORDER BY r.role_id, u.full_name';
    res.json(db.all(sql, params));
});

router.get('/:id', authenticate, (req, res) => {
    const u = db.get(`SELECT u.user_id, u.username, u.full_name, u.email, u.is_active, u.dept_id,
    r.role_name AS role, d.dept_name
    FROM Users u JOIN Roles r ON u.role_id = r.role_id LEFT JOIN Departments d ON u.dept_id = d.dept_id
    WHERE u.user_id = ?`, [req.params.id]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json(u);
});

// POST /users — Admin (any role), HoD/Coordinator (doctor/nurse in own dept)
router.post('/', authenticate, (req, res) => {
    const { role } = req.user;
    if (!['admin', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const { username, password, full_name, email, role_name, dept_id } = req.body;
    if (!username || !password || !full_name || !role_name) return res.status(400).json({ error: 'Missing required fields' });

    // HoD/Coordinator can only create doctor or nurse within their dept
    // Receptionist can only create patient account
    if (['hod', 'coordinator'].includes(role)) {
        if (!['doctor', 'nurse'].includes(role_name)) return res.status(403).json({ error: 'Can only create doctor or nurse accounts' });
    } else if (role === 'receptionist') {
        if (role_name !== 'patient') return res.status(403).json({ error: 'Receptionists can only create patient accounts' });
    }

    const effectiveDeptId = (role === 'admin') ? (dept_id || null) : req.user.dept_id;
    const roleRow = db.get('SELECT role_id FROM Roles WHERE role_name=?', [role_name]);
    if (!roleRow) return res.status(400).json({ error: 'Invalid role' });

    const hash = bcrypt.hashSync(password, 10);
    try {
        const r = db.run(
            'INSERT INTO Users(username,password_hash,role_id,dept_id,facility_id,full_name,email) VALUES(?,?,?,?,1,?,?)',
            [username, hash, roleRow.role_id, effectiveDeptId, full_name, email || null]
        );
        if (role_name === 'doctor') {
            const { specialization, designation, phone, consultation_fee } = req.body;
            db.run('INSERT INTO Doctors(user_id,dept_id,specialization,designation,phone,consultation_fee,status) VALUES(?,?,?,?,?,?,?)',
                [r.lastInsertRowid, effectiveDeptId, specialization || 'General', designation || 'Consultant', phone || null, consultation_fee || 0, 'available']);
        }
        db.persist();
        res.json({ user_id: r.lastInsertRowid, success: true });
    } catch (e) {
        return res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Username or email already exists' : e.message });
    }
});

// PUT /users/:id — Admin (any), HoD/Coordinator (dept-scoped doctor/nurse)
router.put('/:id', authenticate, (req, res) => {
    const { role } = req.user;
    const targetId = parseInt(req.params.id);
    const target = db.get('SELECT u.*, r.role_name FROM Users u JOIN Roles r ON u.role_id = r.role_id WHERE u.user_id=?', [targetId]);
    if (!target) return res.status(404).json({ error: 'Not found' });

    // Self-edit always allowed
    if (req.user.user_id !== targetId) {
        if (!['admin', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
        if (['hod', 'coordinator'].includes(role)) {
            if (!['doctor', 'nurse'].includes(target.role_name)) return res.status(403).json({ error: 'Can only edit doctor/nurse accounts' });
            if (!checkDeptScope(req, res, target.dept_id)) return;
        }
    }

    const { full_name, email, password } = req.body;
    if (full_name) db.run('UPDATE Users SET full_name=? WHERE user_id=?', [full_name, targetId]);
    if (email) db.run('UPDATE Users SET email=? WHERE user_id=?', [email, targetId]);
    if (password) db.run('UPDATE Users SET password_hash=? WHERE user_id=?', [bcrypt.hashSync(password, 10), targetId]);
    db.persist();
    res.json({ success: true });
});

// DELETE /users/:id — Admin (any), HoD (dept-scoped, no admin/hod deletion)
router.delete('/:id', authenticate, (req, res) => {
    const { role } = req.user;
    if (!['admin', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const target = db.get('SELECT u.*, r.role_name FROM Users u JOIN Roles r ON u.role_id = r.role_id WHERE u.user_id=?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (['hod', 'coordinator'].includes(role)) {
        if (['admin', 'hod'].includes(target.role_name)) return res.status(403).json({ error: 'Cannot delete admin or HoD accounts' });
        if (!checkDeptScope(req, res, target.dept_id)) return;
    }
    db.run('DELETE FROM Doctors WHERE user_id=?', [req.params.id]);
    db.run('DELETE FROM Feedback WHERE patient_user_id=?', [req.params.id]);
    db.run('DELETE FROM Schedules WHERE user_id=?', [req.params.id]);
    db.run('DELETE FROM Users WHERE user_id=?', [req.params.id]);
    db.persist();
    res.json({ success: true });
});

// PATCH /users/:id/access — Admin (any), HoD/Coordinator (dept-scoped)
router.patch('/:id/access', authenticate, (req, res) => {
    const { role } = req.user;
    if (!['admin', 'hod', 'coordinator'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const target = db.get('SELECT * FROM Users WHERE user_id=?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (['hod', 'coordinator'].includes(role) && !checkDeptScope(req, res, target.dept_id)) return;
    const { is_active } = req.body;
    db.run('UPDATE Users SET is_active=? WHERE user_id=?', [is_active ? 1 : 0, req.params.id]);
    db.persist();
    res.json({ success: true, is_active: is_active ? 1 : 0 });
});

module.exports = router;
