const { list } = require('@vercel/blob');

module.exports = async (req, res) => {
  try {
    const isAdmin = req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

    const { blobs } = await list({
      prefix: 'meta/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const files = [];
    for (const b of blobs) {
      try {
        const resp = await fetch(b.url);
        const meta = await resp.json();

        if (meta.visibility === 'public' || isAdmin) {
          files.push({
            name: meta.name,
            url: meta.url,
            path: meta.path,
            visibility: meta.visibility,
            uploader: meta.uploader,
            date: meta.date,
            metaPath: b.pathname,
          });
        }
      } catch (innerErr) {
        console.error('Erreur lecture meta:', b.pathname, innerErr.message);
      }
    }

    files.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({ files });
  } catch (err) {
    console.error('LIST ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};
