const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const filename = req.headers['x-filename'] || 'fichier';
    const visibility = req.headers['x-visibility'] === 'private' ? 'private' : 'public';
    const uploaderName = req.headers['x-uploader'] || 'Anonyme';

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const safeName = `${Date.now()}-${filename}`.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const blob = await put(`uploads/${safeName}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
    });

    const metaBlob = await put(
      `meta/${safeName}.json`,
      JSON.stringify({
        name: filename,
        url: blob.url,
        path: `uploads/${safeName}`,
        visibility,
        uploader: uploaderName,
        date: new Date().toISOString(),
      }),
      { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur upload' });
  }
};

module.exports.config = {
  api: { bodyParser: false },
};
