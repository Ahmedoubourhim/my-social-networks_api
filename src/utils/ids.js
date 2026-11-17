const mongoose = require('mongoose');

exports.isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;

// Compare deux ids (ObjectId, string ou document peuplé)
exports.same = (a, b) => String(a && a._id ? a._id : a) === String(b && b._id ? b._id : b);

// Teste si un tableau d'ids (ou de documents peuplés) contient l'id donné
exports.includesId = (list, id) => (list || []).some((x) => exports.same(x, id));
