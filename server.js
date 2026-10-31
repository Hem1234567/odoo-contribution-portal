import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedUsers, packages, isPackagePath } from './src/config.js';
import { createLoginUrl, exchangeCode, getGitHubUser } from './src/oauth.js';
import { createPackageZip, submitPackage } from './src/github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const production = process.env.NODE_ENV === 'production';

for (const key of ['SESSION_SECRET','GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET','GITHUB_APP_ID','GITHUB_APP_PRIVATE_KEY','GITHUB_APP_INSTALLATION_ID']) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (production && !process.env.BASE_URL?.startsWith('https://')) {
  throw new Error('BASE_URL must be HTTPS in production.');
}
if (production) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "https://avatars.githubusercontent.com", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '32kb' }));
let sessionStore;
if (process.env.REDIS_URL) {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', err => console.error('Redis session store error:', err));
  await redisClient.connect();
  sessionStore = new RedisStore({ client: redisClient, prefix: 'odoo-contrib:' });
} else if (production) {
  throw new Error('REDIS_URL is required in production for persistent contributor sessions.');
}

app.use(session({
  name: 'odoo-contrib.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 }
});

function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in with your authorized GitHub account.' });
  next();
}

app.get('/auth/github', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  res.redirect(createLoginUrl(state));
});

app.get('/auth/github/callback', async (req, res, next) => {
  try {
    if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) {
      return res.status(400).send('Invalid OAuth state. Restart GitHub sign-in.');
    }
    delete req.session.oauthState;
    const token = await exchangeCode(req.query.code);
    const user = await getGitHubUser(token);
    const packageIds = allowedUsers[user.login.toLowerCase()];
    if (!packageIds) return res.status(403).send('This GitHub account is not on the contributor allowlist.');
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { login: user.login, avatar: user.avatar_url, packageIds };
      res.redirect('/');
    });
  } catch (err) { next(err); }
});

app.post('/auth/logout', requireUser, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  const user = req.session.user;
  if (!user) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    login: user.login,
    avatar: user.avatar,
    packages: user.packageIds.map(id => packages[id])
  });
});

app.get('/api/package/:packageId/download', requireUser, async (req, res, next) => {
  try {
    if (!req.session.user.packageIds.includes(req.params.packageId)) return res.status(403).json({ error: 'This package is not assigned to your account.' });
    const pkg = packages[req.params.packageId];
    const zip = await createPackageZip(pkg);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.id}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    zip.pipe(res);
  } catch (err) { next(err); }
});

app.post('/api/package/:packageId/submit', requireUser, upload.single('package'), async (req, res, next) => {
  try {
    if (!req.session.user.packageIds.includes(req.params.packageId)) return res.status(403).json({ error: 'This package is not assigned to your account.' });
    if (!req.file) return res.status(400).json({ error: 'Upload a ZIP file.' });
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) return res.status(400).json({ error: 'Only ZIP submissions are accepted.' });
    const result = await submitPackage(packages[req.params.packageId], req.file.buffer, req.session.user.login);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'The request failed. Check the portal server logs.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Contribution portal listening on ${port}`));
