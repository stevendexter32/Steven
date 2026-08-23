const { del } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const isAdmin = req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
    if (!isAdmin) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    let body = req.body;
    if (!body || typeof body === 'string') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    }

    const { filePath, metaPath } = body;
    if (!filePath || !metaPath) {
      return res.status(400).json({ error: 'Chemins manquants' });
    }

    await del(filePath, { token: process.env.BLOB_READ_WRITE_TOKEN });
    await del(metaPath, { token: process.env.BLOB_READ_WRITE_TOKEN });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports.config = {
  api: { bodyParser: false },
};
