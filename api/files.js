const { put, list, del } = require('@vercel/blob');
const crypto = require('crypto');

const MAX_SIZE = 4 * 1024 * 1024;        // 4 Mo par fichier (limite Vercel ~4,5 Mo)
const MAX_FILES = 300;                   // nombre maximum de fichiers stockés
const MAX_TOTAL = 300 * 1024 * 1024;     // stockage total maximum (300 Mo)

// Types connus : les autres sont stockés comme "binaire" (jamais affichés par le navigateur)
const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Vérifie le mot de passe admin (refuse si ADMIN_PASSWORD n'est pas défini)
async function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers['x-admin-password'];
  if (!expected || given !== expected) {
    await sleep(600); // ralentit les essais au hasard
    return false;
  }
  return true;
}

// Nettoie un nom de fichier : sans accents ni caractères spéciaux, sans point au début
function cleanName(raw) {
  let name = String(raw || 'document');
  try { name = decodeURIComponent(name); } catch (e) {}
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').replace(/\s+/g, '_');
  name = name.replace(/^\.+/, '').slice(0, 80);
  return name || 'document';
}

function extOf(name) {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

// "public/{fin}_{id}/nom" -> { until, oid }
function parsePublic(pathname) {
  const dir = pathname.split('/')[1] || '';
  const i = dir.indexOf('_');
  if (i < 1) return null;
  const until = parseInt(dir.slice(0, i), 10);
  if (!until) return null;
  return { until, oid: dir.slice(i + 1) };
}

module.exports = async (req, res) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    // ---------- LISTER (mot de passe) ----------
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      if (!(await isAdmin(req))) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const [orig, pub] = await Promise.all([
        list({ prefix: 'files/', token }),
        list({ prefix: 'public/', token }),
      ]);

      // Copies actuellement visibles sur l'accueil (non expirées)
      const now = Date.now();
      const publishedBy = {};
      pub.blobs.forEach((b) => {
        const p = parsePublic(b.pathname);
        if (!p || p.until <= now) return;
        if (!publishedBy[p.oid] || publishedBy[p.oid].until < p.until) {
          publishedBy[p.oid] = { until: new Date(p.until).toISOString(), pathname: b.pathname };
        }
      });

      const files = orig.blobs
        .map((b) => {
          const parts = b.pathname.split('/');
          const name = parts[parts.length - 1];
          return {
            name,
            ext: extOf(name),
            pathname: b.pathname,
            size: b.size,
            date: b.uploadedAt,
            downloadUrl: b.downloadUrl || b.url + '?download=1',
            published: publishedBy[parts[1]] || null,
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      return res.status(200).json({ files });
    }

    // ---------- ENVOYER / ENREGISTRER (libre, sans mot de passe) ----------
    if (req.method === 'POST') {
      const declared = parseInt(req.headers['content-length'] || '0', 10);
      if (declared > MAX_SIZE) {
        return res.status(413).json({ error: 'Fichier trop gros (4 Mo maximum)' });
      }

      const filename = cleanName(req.headers['x-filename']);

      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        total += chunk.length;
        if (total > MAX_SIZE) {
          return res.status(413).json({ error: 'Fichier trop gros (4 Mo maximum)' });
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Fichier vide' });
      }

      // Protection : nombre de fichiers et stockage total limités
      const { blobs } = await list({ prefix: 'files/', token });
      const used = blobs.reduce((sum, b) => sum + b.size, 0);
      if (blobs.length >= MAX_FILES || used + buffer.length > MAX_TOTAL) {
        return res.status(507).json({ error: 'Le stockage est plein pour le moment' });
      }

      // Dossier unique et imprévisible : le lien ne peut pas être deviné
      const dir = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
      await put(`files/${dir}/${filename}`, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: MIME[extOf(filename)] || 'application/octet-stream',
        token,
      });
      return res.status(200).json({ success: true });
    }

    // ---------- SUPPRIMER (mot de passe) ----------
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }
      const pathname = String(req.query.path || '');
      const isOriginal = pathname.startsWith('files/');
      const isCopy = pathname.startsWith('public/');
      if ((!isOriginal && !isCopy) || pathname.includes('..')) {
        return res.status(400).json({ error: 'Chemin invalide' });
      }

      const { blobs } = await list({ prefix: pathname, token });
      const target = blobs.find((b) => b.pathname === pathname);
      if (!target) {
        return res.status(404).json({ error: 'Fichier introuvable' });
      }
      const urls = [target.url];

      // Supprimer l'original retire aussi sa copie de l'accueil
      if (isOriginal) {
        const oid = pathname.split('/')[1];
        const pub = await list({ prefix: 'public/', token });
        pub.blobs.forEach((b) => {
          const p = parsePublic(b.pathname);
          if (p && p.oid === oid) urls.push(b.url);
        });
      }

      await del(urls, { token });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('FILES ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// On lit le corps brut nous-mêmes (fichiers binaires)
module.exports.config = {
  api: { bodyParser: false },
};
