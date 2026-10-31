const { list, del } = require('@vercel/blob');

// Liste publique (sans mot de passe) des fichiers mis à l'accueil.
// À chaque appel, les copies expirées sont supprimées pour de bon.
// Vercel appelle aussi cette adresse chaque jour (voir vercel.json) pour nettoyer
// même quand personne ne visite le site.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const { blobs } = await list({ prefix: 'public/', token });
    const now = Date.now();
    const expired = [];
    const files = [];

    blobs.forEach((b) => {
      const parts = b.pathname.split('/');
      const dir = parts[1] || '';
      const until = parseInt(dir.split('_')[0], 10);
      if (!until || until <= now) {
        expired.push(b.url);
        return;
      }
      const name = parts[parts.length - 1];
      const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
      files.push({
        name,
        ext: m ? m[1].toLowerCase() : '',
        size: b.size,
        until: new Date(until).toISOString(),
        downloadUrl: b.downloadUrl || b.url + '?download=1',
      });
    });

    if (expired.length) {
      try { await del(expired, { token }); }
      catch (e) { console.error('CLEANUP ERROR:', e.message); }
    }

    files.sort((a, b) => new Date(a.until) - new Date(b.until));
    return res.status(200).json({ files });
  } catch (err) {
    console.error('PUBLIC ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};
