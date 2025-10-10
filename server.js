import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3030;

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR   = path.join(PUBLIC_DIR, 'data');
const LOGO_DIR   = path.join(PUBLIC_DIR, 'logos');

[PUBLIC_DIR, DATA_DIR, LOGO_DIR].forEach((p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ---- State
const SCORE_JSON = path.join(DATA_DIR, 'score.json');
function defaultState () {
  return {
    teamAName: "TEAM A",
    teamALogo: "",
    teamBName: "TEAM B",
    teamBLogo: "",
    scoreA: 0,
    scoreB: 0,
    setsWonA: 0,
    setsWonB: 0,
    setScores: [],         
    serve: null,           
    timeoutA: false,
    timeoutB: false,
    matchStatus: "WARMUP", 
    updatedAt: new Date().toISOString()
  };
}
if (!fs.existsSync(SCORE_JSON)) {
  fs.writeFileSync(SCORE_JSON, JSON.stringify(defaultState(), null, 2), 'utf8');
}

// Serve vMix-friendly JSON at /data/score.json
app.get('/data/score.json', (req, res) => {
    try {
      const s = readScore();
      // wrap in array so vMix sees a "table"
      const row = {
        teamAName:  s.teamAName,
        teamALogo:  s.teamALogo,
        teamBName:  s.teamBName,
        teamBLogo:  s.teamBLogo,
        scoreA:     s.scoreA,
        scoreB:     s.scoreB,
        setsWonA:   s.setsWonA,
        setsWonB:   s.setsWonB,
        serve:      s.serve,
        timeoutA:   s.timeoutA,
        timeoutB:   s.timeoutB,
        matchStatus:s.matchStatus,
        updatedAt:  s.updatedAt
      };
  
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json([row]); 
    } catch (e) {
      res.status(500).json([{ error: e.message }]);
    }
  });

  
// ---- Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// ---- Multer (logos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGO_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = /\.(png|jpg|jpeg|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only PNG/JPG/WEBP allowed'), ok);
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

const readScore  = () => JSON.parse(fs.readFileSync(SCORE_JSON, 'utf8'));
const writeScore = (obj) => {
  obj.updatedAt = new Date().toISOString();
  fs.writeFileSync(SCORE_JSON, JSON.stringify(obj, null, 2), 'utf8');
};

// ---- API
app.get('/api/score', (req, res) => {
  try   { res.json(readScore()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/score', (req, res) => {
  try {
    const next = { ...readScore(), ...req.body };
    writeScore(next);
    res.json(next);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/score/increment', (req, res) => {
  const { team } = req.body; 
  const data = readScore();
  if (team === 'A') data.scoreA += 1;
  if (team === 'B') data.scoreB += 1;
  writeScore(data);
  res.json(data);
});

app.post('/api/score/decrement', (req, res) => {
  const { team } = req.body; // "A" | "B"
  const data = readScore();
  if (team === 'A') data.scoreA = Math.max(0, data.scoreA - 1);
  if (team === 'B') data.scoreB = Math.max(0, data.scoreB - 1);
  writeScore(data);
  res.json(data);
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/logos/${req.file.filename}` });
});

// ✅ Reset for next match: clears logos + resets JSON
app.post('/api/reset-all', (req, res) => {
  try {
    if (fs.existsSync(LOGO_DIR)) {
      for (const f of fs.readdirSync(LOGO_DIR)) {
        try { fs.unlinkSync(path.join(LOGO_DIR, f)); } catch {}
      }
    }
    const fresh = defaultState();
    writeScore(fresh);
    res.json({ ok: true, data: fresh });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Volley score updater running on http://localhost:${PORT}`);
});
