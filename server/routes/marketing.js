import express from 'express';
import db from '../db.js';

const router = express.Router();

const recentByIp = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

router.post('/contact', async (req, res) => {
  const {
    name,
    company,
    email,
    phone,
    country,
    intent,
    message
  } = req.body || {};

  const clean = {
    name: String(name || '').trim().slice(0, 120),
    company: String(company || '').trim().slice(0, 160),
    email: String(email || '').trim().slice(0, 190),
    phone: String(phone || '').trim().slice(0, 40),
    country: String(country || '').trim().slice(0, 80),
    intent: String(intent || 'demo').trim().slice(0, 40),
    message: String(message || '').trim().slice(0, 2000)
  };

  if (!clean.name || !clean.email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!['demo', 'partner'].includes(clean.intent)) {
    clean.intent = 'demo';
  }

  const ip = clientIp(req);
  const now = Date.now();
  const last = recentByIp.get(ip) || 0;
  if (now - last < 15_000) {
    return res.status(429).json({ error: 'Please wait a moment before submitting again' });
  }
  recentByIp.set(ip, now);

  try {
    const [result] = await db.query(
      `INSERT INTO marketing_inquiries
        (name, company, email, phone, country, intent, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clean.name,
        clean.company || null,
        clean.email,
        clean.phone || null,
        clean.country || null,
        clean.intent,
        clean.message || null
      ]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Marketing contact error:', error);
    res.status(500).json({ error: 'Failed to save inquiry' });
  }
});

export default router;
