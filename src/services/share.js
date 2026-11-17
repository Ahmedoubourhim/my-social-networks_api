const { publicUrl } = require('../config/env');

// Liens de partage d'un événement vers les réseaux sociaux
exports.shareLinks = (event) => {
  const url = `${publicUrl}/api/v1/events/${event._id}`;
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(event.name);
  return {
    url,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    x: `https://twitter.com/intent/tweet?url=${u}&text=${text}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    whatsapp: `https://wa.me/?text=${text}%20${u}`,
  };
};
