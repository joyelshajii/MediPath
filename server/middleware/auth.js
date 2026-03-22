'use strict';
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'medipath_secret_2026';

// Require valid token — rejects 401 if missing/invalid
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        req.user = jwt.verify(header.slice(7), JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Attach user if token present, but allow through regardless (for public routes)
function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try { req.user = jwt.verify(header.slice(7), JWT_SECRET); } catch { /* ignore */ }
    }
    next();
}

// Require specific role(s)
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }
        next();
    };
}

// Department-scoped access check: Admin bypasses, HoD/Coordinator must match dept
function checkDeptScope(req, res, targetDeptId) {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return false; }
    if (req.user.role === 'admin') return true;
    if (['hod', 'coordinator'].includes(req.user.role)) {
        if (req.user.dept_id === parseInt(targetDeptId)) return true;
        res.status(403).json({ error: 'Forbidden: outside your department scope' });
        return false;
    }
    res.status(403).json({ error: 'Forbidden: insufficient role' });
    return false;
}

module.exports = { authenticate, optionalAuth, authorize, checkDeptScope, JWT_SECRET };
