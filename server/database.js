'use strict';
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'medipath.sqlite');

let _db = null;
let _dbReady = false;
let _dbInitCallbacks = [];

async function initDb() {
  const SQL = await initSqlJs();
  let data;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }
  _db = new SQL.Database(data || undefined);
  _db.run('PRAGMA foreign_keys = ON;');
  createSchema();
  // Migration: add patient_id if not exists
  try {
    _db.run('ALTER TABLE Feedback ADD COLUMN patient_id TEXT;');
  } catch (e) { /* already exists */ }
  seed();
  _dbReady = true;
  _dbInitCallbacks.forEach(cb => cb(_db));
  _dbInitCallbacks = [];
  return _db;
}

function persist() {
  if (_db) {
    fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
  }
}

// ─── Helper wrappers to mimic better-sqlite3 API ─────────
function run(sql, params = []) {
  _db.run(sql, params);
  const rows = _db.exec('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: rows[0]?.values[0][0] || 0, changes: _db.getRowsModified() };
}

function get(sql, params = []) {
  const result = _db.exec(sql, params);
  if (!result.length || !result[0].values.length) return undefined;
  const cols = result[0].columns;
  const vals = result[0].values[0];
  const obj = {};
  cols.forEach((c, i) => { obj[c] = vals[i]; });
  return obj;
}

function all(sql, params = []) {
  const result = _db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(vals => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    return obj;
  });
}

// ─── Schema ───────────────────────────────────────────────
function createSchema() {
  _db.run(`
    CREATE TABLE IF NOT EXISTS Facilities (
      facility_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      type TEXT NOT NULL DEFAULT 'hospital'
    );

    CREATE TABLE IF NOT EXISTS Roles (
      role_id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS Departments (
      dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id INTEGER NOT NULL DEFAULT 1,
      dept_name TEXT NOT NULL,
      dept_code TEXT NOT NULL,
      floor TEXT,
      UNIQUE(facility_id, dept_code)
    );

    CREATE TABLE IF NOT EXISTS Users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      dept_id INTEGER,
      facility_id INTEGER NOT NULL DEFAULT 1,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Nodes (
      node_id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id INTEGER NOT NULL DEFAULT 1,
      x REAL NOT NULL,
      y REAL NOT NULL,
      floor TEXT NOT NULL DEFAULT 'Ground',
      node_type TEXT NOT NULL DEFAULT 'corridor',
      label TEXT,
      qr_code TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS Edges (
      edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id INTEGER NOT NULL DEFAULT 1,
      from_node_id INTEGER NOT NULL,
      to_node_id INTEGER NOT NULL,
      distance REAL NOT NULL DEFAULT 1.0,
      is_accessible INTEGER NOT NULL DEFAULT 1,
      UNIQUE(from_node_id, to_node_id)
    );

    CREATE TABLE IF NOT EXISTS Doctors (
      doctor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      dept_id INTEGER NOT NULL,
      specialization TEXT NOT NULL,
      designation TEXT NOT NULL DEFAULT 'Consultant',
      current_node_id INTEGER,
      status TEXT NOT NULL DEFAULT 'available',
      phone TEXT,
      consultation_fee REAL
    );

    CREATE TABLE IF NOT EXISTS Feedback (
      feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      patient_user_id INTEGER,
      patient_id TEXT,
      raw_text TEXT NOT NULL,
      rating INTEGER DEFAULT 3,
      sentiment_score REAL,
      extracted_keywords TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Schedules (
      schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      schedule_type TEXT NOT NULL DEFAULT 'appointment',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS NurseAllocations (
      allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurse_user_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      duty_date TEXT NOT NULL,
      shift TEXT NOT NULL DEFAULT 'day',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Seed ─────────────────────────────────────────────────
function seed() {
  const existing = get('SELECT COUNT(*) as c FROM Roles');
  if (existing && existing.c > 0) { console.log('[DB] Already seeded.'); return; }
  console.log('[DB] Seeding MediPath database...');

  // ── Facility ──
  run(`INSERT INTO Facilities(name, address, type) VALUES(?, ?, ?)`,
    ["St. Joseph's Mission Hospital", 'Mannanam, Kottayam, Kerala 686561', 'hospital']);

  // ── Roles ──
  for (const r of ['admin', 'hod', 'coordinator', 'doctor', 'nurse', 'patient', 'receptionist']) {
    run('INSERT INTO Roles(role_name) VALUES(?)', [r]);
  }
  const getRoleId = (n) => get('SELECT role_id FROM Roles WHERE role_name=?', [n]).role_id;

  // ── Departments ──
  const depts = [
    ['General Medicine', 'MED', 'Ground Floor'],
    ['Cardiology', 'CARD', 'First Floor'],
    ['Orthopedics', 'ORTH', 'First Floor'],
    ['Pediatrics', 'PED', 'Ground Floor'],
    ['Radiology', 'RAD', 'Basement'],
    ['Emergency', 'ER', 'Ground Floor'],
  ];
  for (const [name, code, floor] of depts) {
    run('INSERT INTO Departments(facility_id, dept_name, dept_code, floor) VALUES(1,?,?,?)', [name, code, floor]);
  }
  const getDeptId = (code) => get('SELECT dept_id FROM Departments WHERE dept_code=?', [code]).dept_id;
  const medDept = getDeptId('MED');
  const cardDept = getDeptId('CARD');
  const orthDept = getDeptId('ORTH');
  const pedDept = getDeptId('PED');
  const radDept = getDeptId('RAD');
  const erDept = getDeptId('ER');

  // ── Nodes — Hospital Floor Plan ──
  // Ground Floor nodes (y: 50-350)
  const nodes = [
    // Main Entrance & Lobby
    [100, 400, 'Ground', 'entrance', 'Main Entrance', 'QR-ENTRANCE-MAIN'],
    [250, 400, 'Ground', 'corridor', 'Reception Lobby', 'QR-LOBBY'],
    [250, 300, 'Ground', 'room', 'Reception Desk', 'QR-RECEPTION'],
    // Ground Floor Corridor
    [250, 200, 'Ground', 'corridor', 'Ground Corridor A', null],
    [400, 200, 'Ground', 'corridor', 'Ground Corridor B', null],
    [550, 200, 'Ground', 'corridor', 'Ground Corridor C', null],
    [700, 200, 'Ground', 'corridor', 'Ground Corridor D', null],
    // Ground Floor Rooms
    [400, 100, 'Ground', 'room', 'Room G-101 (Gen Med)', 'QR-G101'],
    [400, 300, 'Ground', 'room', 'Room G-102 (Gen Med)', 'QR-G102'],
    [550, 100, 'Ground', 'room', 'Room G-103 (Pediatrics)', 'QR-G103'],
    [550, 300, 'Ground', 'room', 'Room G-104 (Pediatrics)', 'QR-G104'],
    [700, 100, 'Ground', 'room', 'ER Bay 1', 'QR-ER1'],
    [700, 300, 'Ground', 'room', 'ER Bay 2', 'QR-ER2'],
    // Elevator & Stairs
    [250, 100, 'Ground', 'elevator', 'Elevator (Ground)', 'QR-ELEV-G'],
    [150, 100, 'Ground', 'stairs', 'Stairwell (Ground)', 'QR-STAIRS-G'],
    // Emergency Entrance
    [850, 200, 'Ground', 'entrance', 'Emergency Entrance', 'QR-ENTRANCE-ER'],
    // First Floor nodes (y: 50-350)
    [250, 100, 'First', 'elevator', 'Elevator (First)', 'QR-ELEV-F1'],
    [150, 100, 'First', 'stairs', 'Stairwell (First)', 'QR-STAIRS-F1'],
    [250, 200, 'First', 'corridor', 'First Floor Corridor A', null],
    [400, 200, 'First', 'corridor', 'First Floor Corridor B', null],
    [550, 200, 'First', 'corridor', 'First Floor Corridor C', null],
    [700, 200, 'First', 'corridor', 'First Floor Corridor D', null],
    // First Floor Rooms
    [400, 100, 'First', 'room', 'Room F-201 (Cardiology)', 'QR-F201'],
    [400, 300, 'First', 'room', 'Room F-202 (Cardiology)', 'QR-F202'],
    [550, 100, 'First', 'room', 'Room F-203 (Orthopedics)', 'QR-F203'],
    [550, 300, 'First', 'room', 'Room F-204 (Orthopedics)', 'QR-F204'],
    [700, 100, 'First', 'room', 'Room F-205 (Surgery)', 'QR-F205'],
    [700, 300, 'First', 'room', 'Room F-206 (ICU)', 'QR-F206'],
    // Basement nodes
    [250, 100, 'Basement', 'elevator', 'Elevator (Basement)', 'QR-ELEV-B'],
    [250, 200, 'Basement', 'corridor', 'Basement Corridor', null],
    [400, 200, 'Basement', 'room', 'Radiology Lab', 'QR-RAD-LAB'],
    [550, 200, 'Basement', 'room', 'MRI Room', 'QR-MRI'],
    [400, 100, 'Basement', 'room', 'Pharmacy', 'QR-PHARMACY'],
  ];

  for (const [x, y, floor, type, label, qr] of nodes) {
    run('INSERT INTO Nodes(facility_id, x, y, floor, node_type, label, qr_code) VALUES(1,?,?,?,?,?,?)',
      [x, y, floor, type, label, qr || null]);
  }

  const getNodeId = (label) => get('SELECT node_id FROM Nodes WHERE label=?', [label]).node_id;

  // ── Edges ──
  const edges = [
    // Ground Floor connections
    ['Main Entrance', 'Reception Lobby', 2],
    ['Reception Lobby', 'Reception Desk', 1.5],
    ['Reception Lobby', 'Ground Corridor A', 3],
    ['Ground Corridor A', 'Ground Corridor B', 3],
    ['Ground Corridor B', 'Ground Corridor C', 3],
    ['Ground Corridor C', 'Ground Corridor D', 3],
    ['Ground Corridor B', 'Room G-101 (Gen Med)', 1.5],
    ['Ground Corridor B', 'Room G-102 (Gen Med)', 1.5],
    ['Ground Corridor C', 'Room G-103 (Pediatrics)', 1.5],
    ['Ground Corridor C', 'Room G-104 (Pediatrics)', 1.5],
    ['Ground Corridor D', 'ER Bay 1', 1.5],
    ['Ground Corridor D', 'ER Bay 2', 1.5],
    ['Ground Corridor A', 'Elevator (Ground)', 1.5],
    ['Ground Corridor A', 'Stairwell (Ground)', 2],
    ['Ground Corridor D', 'Emergency Entrance', 2.5],
    // Elevator connections between floors
    ['Elevator (Ground)', 'Elevator (First)', 2],
    ['Elevator (Ground)', 'Elevator (Basement)', 2],
    ['Elevator (First)', 'Elevator (Basement)', 4],
    // Stairwell connections
    ['Stairwell (Ground)', 'Stairwell (First)', 3],
    // First Floor connections
    ['Elevator (First)', 'First Floor Corridor A', 1.5],
    ['Stairwell (First)', 'First Floor Corridor A', 2],
    ['First Floor Corridor A', 'First Floor Corridor B', 3],
    ['First Floor Corridor B', 'First Floor Corridor C', 3],
    ['First Floor Corridor C', 'First Floor Corridor D', 3],
    ['First Floor Corridor B', 'Room F-201 (Cardiology)', 1.5],
    ['First Floor Corridor B', 'Room F-202 (Cardiology)', 1.5],
    ['First Floor Corridor C', 'Room F-203 (Orthopedics)', 1.5],
    ['First Floor Corridor C', 'Room F-204 (Orthopedics)', 1.5],
    ['First Floor Corridor D', 'Room F-205 (Surgery)', 1.5],
    ['First Floor Corridor D', 'Room F-206 (ICU)', 1.5],
    // Basement connections
    ['Elevator (Basement)', 'Basement Corridor', 1.5],
    ['Basement Corridor', 'Radiology Lab', 2],
    ['Basement Corridor', 'MRI Room', 3],
    ['Basement Corridor', 'Pharmacy', 2],
  ];

  for (const [fromLabel, toLabel, dist] of edges) {
    const fromId = getNodeId(fromLabel);
    const toId = getNodeId(toLabel);
    run('INSERT INTO Edges(facility_id, from_node_id, to_node_id, distance) VALUES(1,?,?,?)', [fromId, toId, dist]);
    // Bidirectional
    run('INSERT INTO Edges(facility_id, from_node_id, to_node_id, distance) VALUES(1,?,?,?)', [toId, fromId, dist]);
  }

  // ── Create user helper ──
  const createUser = (uname, pw, role, deptId, name, email) => {
    const hash = bcrypt.hashSync(pw, 10);
    const rid = getRoleId(role);
    return run('INSERT INTO Users(username,password_hash,role_id,dept_id,facility_id,full_name,email) VALUES(?,?,?,?,1,?,?)',
      [uname, hash, rid, deptId, name, email || null]).lastInsertRowid;
  };

  // ── Admin ──
  createUser('admin', 'admin123', 'admin', null, 'System Administrator', 'admin@medipath.in');

  // ── Receptionist ──
  createUser('reception1', 'rec123', 'receptionist', null, 'Anitha Krishnan', 'anitha@sjmh.in');

  // ── Doctors ──
  const docData = [
    ['dr.kumar', 'doc123', medDept, 'Dr. Rajesh Kumar', 'rajesh.kumar@sjmh.in', 'Internal Medicine', 'Senior Consultant', 'Room G-101 (Gen Med)', '9876543001', 500],
    ['dr.mary', 'doc123', medDept, 'Dr. Mary Thomas', 'mary.thomas@sjmh.in', 'General Practice', 'Consultant', 'Room G-102 (Gen Med)', '9876543002', 400],
    ['dr.anand', 'doc123', cardDept, 'Dr. Anand Pillai', 'anand.pillai@sjmh.in', 'Cardiology', 'Senior Consultant', 'Room F-201 (Cardiology)', '9876543003', 800],
    ['dr.priya', 'doc123', cardDept, 'Dr. Priya Menon', 'priya.menon@sjmh.in', 'Interventional Cardiology', 'Consultant', 'Room F-202 (Cardiology)', '9876543004', 700],
    ['dr.suresh', 'doc123', orthDept, 'Dr. Suresh Nair', 'suresh.nair@sjmh.in', 'Orthopedic Surgery', 'HOD & Senior Consultant', 'Room F-203 (Orthopedics)', '9876543005', 600],
    ['dr.leena', 'doc123', pedDept, 'Dr. Leena George', 'leena.george@sjmh.in', 'Pediatrics', 'Senior Consultant', 'Room G-103 (Pediatrics)', '9876543006', 450],
  ];

  for (const [uname, pw, deptId, name, email, spec, desig, roomLabel, phone, fee] of docData) {
    const uid = createUser(uname, pw, 'doctor', deptId, name, email);
    const nodeId = getNodeId(roomLabel);
    run('INSERT INTO Doctors(user_id, dept_id, specialization, designation, current_node_id, status, phone, consultation_fee) VALUES(?,?,?,?,?,?,?,?)',
      [uid, deptId, spec, desig, nodeId, 'available', phone, fee]);
  }

  // ── Patients ──
  const patients = [
    ['patient1', 'pat123', null, 'Rahul Sharma', 'rahul.sharma@email.com'],
    ['patient2', 'pat123', null, 'Sneha Pillai', 'sneha.pillai@email.com'],
    ['patient3', 'pat123', null, 'Arjun Menon', 'arjun.menon@email.com'],
    ['patient4', 'pat123', null, 'Pooja Nair', 'pooja.nair@email.com'],
    ['patient5', 'pat123', null, 'Kiran Babu', 'kiran.babu@email.com'],
  ];
  for (const [uname, pw, deptId, name, email] of patients) {
    createUser(uname, pw, 'patient', deptId, name, email);
  }

  // ── Nurses ──
  const nurseUid = createUser('nurse.susan', 'nurse123', 'nurse', medDept, 'Susan Philip', 'susan.philip@sjmh.in');
  createUser('nurse.divya', 'nurse123', 'nurse', cardDept, 'Divya Nair', 'divya.nair@sjmh.in');

  // ── HoDs ──
  createUser('hod.med', 'hod123', 'hod', medDept, 'Dr. Anil Varghese', 'anil.varghese@sjmh.in');
  createUser('hod.card', 'hod123', 'hod', cardDept, 'Dr. Shalini Das', 'shalini.das@sjmh.in');

  // ── Coordinators ──
  createUser('coord.med', 'coord123', 'coordinator', medDept, 'Meera Krishnan', 'meera.k@sjmh.in');
  createUser('coord.card', 'coord123', 'coordinator', cardDept, 'Rajan Menon', 'rajan.m@sjmh.in');

  // ── Sample Schedules ──
  const getUserId = (uname) => get('SELECT user_id FROM Users WHERE username=?', [uname]).user_id;
  const schedules = [
    [getUserId('dr.kumar'), 'Morning OPD', 'opd', '2026-03-22T09:00:00', '2026-03-22T13:00:00', 'General consultation'],
    [getUserId('dr.kumar'), 'Afternoon Rounds', 'appointment', '2026-03-22T14:00:00', '2026-03-22T16:00:00', 'Ward rounds'],
    [getUserId('dr.anand'), 'Cardiac OPD', 'opd', '2026-03-22T10:00:00', '2026-03-22T14:00:00', 'Cardiology outpatient'],
    [getUserId('dr.anand'), 'Angioplasty', 'surgery', '2026-03-23T08:00:00', '2026-03-23T12:00:00', 'Planned procedure'],
    [getUserId('dr.suresh'), 'Knee Surgery', 'surgery', '2026-03-22T08:00:00', '2026-03-22T11:00:00', 'Total knee replacement'],
    [getUserId('dr.suresh'), 'Leave', 'leave', '2026-03-25T00:00:00', '2026-03-26T23:59:59', 'Personal leave'],
    [getUserId('dr.priya'), 'Echo Lab', 'appointment', '2026-03-22T09:00:00', '2026-03-22T12:00:00', 'Echocardiography readings'],
    [getUserId('dr.leena'), 'Pediatric OPD', 'opd', '2026-03-22T09:00:00', '2026-03-22T13:00:00', 'Children outpatient'],
    [nurseUid, 'Ward Duty', 'duty', '2026-03-22T07:00:00', '2026-03-22T15:00:00', 'Gen Med ward'],
  ];
  for (const [uid, title, type, start, end, notes] of schedules) {
    run('INSERT INTO Schedules(user_id,title,schedule_type,start_time,end_time,notes) VALUES(?,?,?,?,?,?)', [uid, title, type, start, end, notes]);
  }

  // ── Nurse Allocations ──
  const getDoctorId = (uname) => {
    const u = get('SELECT user_id FROM Users WHERE username=?', [uname]);
    return get('SELECT doctor_id FROM Doctors WHERE user_id=?', [u.user_id]).doctor_id;
  };
  run('INSERT INTO NurseAllocations(nurse_user_id,doctor_id,duty_date,shift,notes) VALUES(?,?,?,?,?)',
    [nurseUid, getDoctorId('dr.kumar'), '2026-03-22', 'day', 'Assist with morning OPD']);
  run('INSERT INTO NurseAllocations(nurse_user_id,doctor_id,duty_date,shift,notes) VALUES(?,?,?,?,?)',
    [getUserId('nurse.divya'), getDoctorId('dr.anand'), '2026-03-22', 'day', 'Assist in cardiac lab']);

  // ── Sample Feedback ──
  const getPatientUid = (uname) => get('SELECT user_id FROM Users WHERE username=?', [uname]).user_id;

  const feedbackData = [
    ['dr.kumar', 'patient1', "Dr. Kumar is incredibly caring and attentive. He listened to all my concerns patiently and explained the diagnosis in detail. Very thorough examination. The clinic was clean and well-organized. Highly recommend him!", 5],
    ['dr.kumar', 'patient2', "Good experience overall. Dr. Kumar is knowledgeable and professional. The only downside was the long waiting time — I waited for over an hour. But the consultation itself was excellent.", 4],
    ['dr.kumar', 'patient3', "Excellent doctor. Very experienced and skilled. He took his time to explain the treatment plan. Felt very reassured after the visit. Clean and comfortable clinic.", 5],
    ['dr.mary', 'patient1', "Dr. Mary was kind and friendly but seemed quite rushed during my consultation. She prescribed medication that worked, but I wish she had spent more time explaining the side effects.", 3],
    ['dr.mary', 'patient4', "Prompt and efficient service. Dr. Mary is professional and gets straight to the point. Sometimes feels a bit cold in her approach, but her diagnosis was accurate.", 3],
    ['dr.mary', 'patient5', "Pleasant experience. Dr. Mary is competent and helpful. The staff was courteous and the environment was clean. Would visit again.", 4],
    ['dr.anand', 'patient2', "Dr. Anand is an exceptional cardiologist. His expertise is unmatched. He explained my heart condition with so much patience and clarity. I felt completely safe under his care. Truly outstanding!", 5],
    ['dr.anand', 'patient3', "Outstanding experience with Dr. Anand. He is brilliant, compassionate, and thorough. The cardiac tests were conducted professionally. He took time to answer every question. Trustworthy and dedicated.", 5],
    ['dr.priya', 'patient1', "Dr. Priya is a skilled cardiologist. Very knowledgeable and experienced. Explained the procedure clearly. Slight discomfort during the procedure but overall a great experience. Recommended!", 4],
    ['dr.priya', 'patient4', "Very professional. Dr. Priya is efficient and caring. The only concern is that appointments are hard to get — had to wait weeks. But once you're in, the care is top-notch.", 4],
    ['dr.suresh', 'patient5', "Dr. Suresh fixed my knee problem that others couldn't. He is truly an expert in orthopedics. A bit expensive, but worth every penny. The recovery was smooth and painless.", 5],
    ['dr.suresh', 'patient2', "Good surgeon but the post-operative care could be better. Felt a bit ignored during follow-up visits. The surgery itself was successful and the results are excellent.", 3],
    ['dr.suresh', 'patient3', "Experienced and skilled orthopedic surgeon. Dr. Suresh is very professional. The operation was effective and I recovered quickly. Grateful for his expertise.", 5],
    ['dr.leena', 'patient4', "Dr. Leena is wonderful with children. My daughter was scared but Dr. Leena was so gentle and reassuring. She explained everything to both me and my child. Very caring and patient doctor.", 5],
    ['dr.leena', 'patient5', "Amazing pediatrician! Dr. Leena is compassionate, attentive, and extremely knowledgeable about children's health. She takes her time with each patient. The clinic is child-friendly and welcoming.", 5],
  ];

  const { processFeedback } = require('./feedback-engine');

  for (const [docUname, patUname, text, rating] of feedbackData) {
    const docId = getDoctorId(docUname);
    const patUid = getPatientUid(patUname);
    const analysis = processFeedback(text);
    const kwStr = JSON.stringify(analysis.keywords);
    run('INSERT INTO Feedback(doctor_id, patient_user_id, raw_text, rating, sentiment_score, extracted_keywords, created_at) VALUES(?,?,?,?,?,?,datetime(?))',
      [docId, patUid, text, rating, analysis.sentimentScore, kwStr, '2026-03-' + String(Math.floor(Math.random() * 20 + 1)).padStart(2, '0') + 'T10:00:00']);
  }

  persist();
  console.log('[DB] MediPath seed complete!');
}

// ─── Exports ──────────────────────────────────────────────
const dbProxy = { run, get, all, persist };
dbProxy.ready = initDb().then(() => dbProxy).catch(e => { console.error('[DB] Init failed:', e); process.exit(1); });

module.exports = dbProxy;
