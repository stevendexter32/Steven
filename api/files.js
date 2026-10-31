const { put, list, del } = require('@vercel/blob');

// Types autorisés : extension -> type MIME
const TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain; charset=utf-8',
};

const MAX_SIZE = 4 * 1024 * 1024; // 4 Mo (limite Vercel ~4,5 Mo)

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

// Nettoie un nom de fichier : sans accents, sans caractères spéciaux
function cleanName(raw) {
  let name = String(raw || 'document');
  try { name = decodeURIComponent(name); } catch (e) {}
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').replace(/\s+/g, '_');
  return name.slice(0, 80) || 'document';
}

module.exports = async (req, res) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    // ---------- LISTER (libre, sans mot de passe) ----------
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const { blobs } = await list({ prefix: 'files/', token });
      const files = blobs
        .map((b) => {
          const parts = b.pathname.split('/');
          const name = parts[parts.length - 1];
          return {
            name,
            ext: (name.split('.').pop() || '').toLowerCase(),
            pathname: b.pathname,
            size: b.size,
            date: b.uploadedAt,
            downloadUrl: b.downloadUrl || b.url + '?download=1',
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      return res.status(200).json({ files });
    }

    // ---------- ENREGISTRER (mot de passe) ----------
    if (req.method === 'POST') {
      if (!(await isAdmin(req))) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const filename = cleanName(req.headers['x-filename']);
      const ext = (filename.split('.').pop() || '').toLowerCase();
      if (!TYPES[ext]) {
        return res.status(400).json({ error: 'Type de fichier non autorisé' });
      }

      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        total += chunk.length;
        if (total > MAX_SIZE) {
          return res.status(413).json({ error: 'Fichier trop gros (4 Mo max)' });
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Fichier vide' });
      }

      // Un dossier par date : le nom de fichier reste propre au téléchargement
      await put(`files/${Date.now()}/${filename}`, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: TYPES[ext],
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
      if (!pathname.startsWith('files/') || pathname.includes('..')) {
        return res.status(400).json({ error: 'Chemin invalide' });
      }
      const { blobs } = await list({ prefix: pathname, token });
      const target = blobs.find((b) => b.pathname === pathname);
      if (!target) {
        return res.status(404).json({ error: 'Fichier introuvable' });
      }
      await del(target.url, { token });
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
