require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { auth, allow } = require('./auth');
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'ElderCare Connect API' }));
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email and password (8+ characters) are required' });
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role', [name, email.toLowerCase(), hash]);
    const user = result.rows[0]; const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.status(201).json({ user, token });
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Email already registered' : 'Registration failed' }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Incorrect email or password' });
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: safeUser, token: jwt.sign(safeUser, process.env.JWT_SECRET, { expiresIn: '8h' }) });
  } catch { res.status(500).json({ error: 'Login failed' }); }
});
app.get('/api/me', auth, async (req, res) => {
  const r = await db.query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user.id]);
  res.json(r.rows[0] || null);
});
app.get('/api/requests', auth, async (req, res) => {
  try {
    const admin = ['ADMIN','DOCTOR','CAREGIVER'].includes(req.user.role);
    const sql = admin ? `SELECT c.*, u.name AS family_name, g.name AS caregiver_name FROM care_requests c JOIN users u ON u.id=c.family_id LEFT JOIN users g ON g.id=c.caregiver_id ORDER BY c.created_at DESC` : `SELECT c.*, u.name AS family_name, g.name AS caregiver_name FROM care_requests c JOIN users u ON u.id=c.family_id LEFT JOIN users g ON g.id=c.caregiver_id WHERE c.family_id=$1 ORDER BY c.created_at DESC`;
    const r = await db.query(sql, admin ? [] : [req.user.id]); res.json(r.rows);
  } catch { res.status(500).json({ error: 'Could not load requests' }); }
});
app.post('/api/requests', auth, async (req, res) => {
  try {
    const { patient_name, service_type, preferred_date, address, notes='' } = req.body;
    if (!patient_name || !service_type || !preferred_date || !address) return res.status(400).json({ error: 'Please complete all required fields' });
    const r = await db.query('INSERT INTO care_requests(patient_name,service_type,preferred_date,address,notes,family_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [patient_name,service_type,preferred_date,address,notes,req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Could not create request' }); }
});
app.patch('/api/requests/:id/assign', auth, allow('ADMIN'), async (req, res) => {
  try {
    const caregiverId = Number(req.body.caregiver_id);
    const exists = await db.query("SELECT id FROM users WHERE id=$1 AND role='CAREGIVER'", [caregiverId]);
    if (!exists.rowCount) return res.status(400).json({ error: 'Choose a valid caregiver account' });
    const r = await db.query("UPDATE care_requests SET caregiver_id=$1,status='ASSIGNED' WHERE id=$2 RETURNING *", [caregiverId, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Request not found' }); res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Assignment failed' }); }
});
app.patch('/api/requests/:id/status', auth, allow('ADMIN','CAREGIVER'), async (req, res) => {
  const allowed = ['IN_PROGRESS','COMPLETED','CANCELLED'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await db.query('UPDATE care_requests SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Request not found' }); res.json(r.rows[0]);
});
app.get('/api/vitals', auth, async (req, res) => {
  const r = await db.query('SELECT v.*,u.name AS recorded_by_name FROM vital_records v JOIN users u ON u.id=v.recorded_by ORDER BY created_at DESC LIMIT 100'); res.json(r.rows);
});
app.post('/api/vitals', auth, allow('ADMIN','DOCTOR','CAREGIVER'), async (req, res) => {
  const { patient_name, systolic, diastolic, heart_rate, spo2, notes='' } = req.body;
  if (!patient_name) return res.status(400).json({ error: 'Patient name is required' });
  const r = await db.query('INSERT INTO vital_records(patient_name,systolic,diastolic,heart_rate,spo2,notes,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [patient_name,systolic||null,diastolic||null,heart_rate||null,spo2||null,notes,req.user.id]);
  res.status(201).json(r.rows[0]);
});
app.get('/api/dashboard', auth, async (req, res) => {
  const scope = ['ADMIN','DOCTOR','CAREGIVER'].includes(req.user.role) ? '' : ' WHERE family_id=$1';
  const params = scope ? [req.user.id] : [];
  const [total,pending,completed,vitals] = await Promise.all([
    db.query(`SELECT COUNT(*)::int n FROM care_requests${scope}`,params),
    db.query(`SELECT COUNT(*)::int n FROM care_requests${scope ? scope+' AND' : ' WHERE'} status='PENDING'`,params),
    db.query(`SELECT COUNT(*)::int n FROM care_requests${scope ? scope+' AND' : ' WHERE'} status='COMPLETED'`,params),
    db.query('SELECT COUNT(*)::int n FROM vital_records')
  ]);
  res.json({ total:total.rows[0].n, pending:pending.rows[0].n, completed:completed.rows[0].n, vitalRecords:vitals.rows[0].n });
});
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`ElderCare Connect API running on http://localhost:${port}`));
