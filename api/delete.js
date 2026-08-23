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

    const { filePath, metaPath } = req.body;
    if (!filePath || !metaPath) {
      return res.status(400).json({ error: 'Chemins manquants' });
    }

    await del(filePath);
    await del(metaPath);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression' });
  }
};
