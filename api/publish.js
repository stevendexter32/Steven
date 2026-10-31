const { list, copy, del } = require('@vercel/blob');

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Mot de passe obligatoire : sinon n'importe qui pourrait afficher un fichier sur ton accueil
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || req.headers['x-admin-password'] !== expected) {
    await sleep(600);
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const body = req.body || {};
    const path = String(body.path || '');
    const hours = Number(body.hours);

    if (!path.startsWith('files/') || path.includes('..')) {
      return res.status(400).json({ error: 'Chemin invalide' });
    }
    if (!(hours > 0 && hours <= 24 * 365)) {
      return res.status(400).json({ error: 'Durée invalide' });
    }

    // L'original doit exister
    const { blobs } = await list({ prefix: path, token });
    const src = blobs.find((b) => b.pathname === path);
    if (!src) {
      return res.status(404).json({ error: 'Fichier introuvable' });
    }

    const parts = path.split('/');
    const oid = parts[1];
    const name = parts[parts.length - 1];
    const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
    const ext = m ? m[1].toLowerCase() : '';

    // S'il est déjà sur l'accueil, on remplace l'ancienne copie (nouvelle durée)
    const pub = await list({ prefix: 'public/', token });
    const olds = pub.blobs
      .filter((b) => {
        const dir = b.pathname.split('/')[1] || '';
        return dir.slice(dir.indexOf('_') + 1) === oid;
      })
      .map((b) => b.url);
    if (olds.length) await del(olds, { token });

    // La fin de disponibilité est écrite dans le nom du dossier : pas besoin de base de données
    const until = Date.now() + Math.round(hours * 3600 * 1000);
    await copy(src.url, `public/${until}_${oid}/${name}`, {
      access: 'public',
      addRandomSuffix: false,
      contentType: MIME[ext] || 'application/octet-stream',
      token,
    });

    return res.status(200).json({ success: true, until: new Date(until).toISOString() });
  } catch (err) {
    console.error('PUBLISH ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};
