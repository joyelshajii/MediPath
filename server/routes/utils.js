'use strict';
const express = require('express');
const db = require('../database');
const router = express.Router();

router.get('/roles', (req, res) => {
    res.json(db.all('SELECT * FROM Roles ORDER BY role_id'));
});

module.exports = router;
