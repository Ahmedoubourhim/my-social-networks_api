const AppError = require('./AppError');

// Échappe les caractères spéciaux d'une saisie utilisateur utilisée dans une regex
exports.escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lit page / limit / sort dans la query string
// sortable : liste des champs autorisés pour le tri (ex: ['name', 'createdAt'])
function parseQuery(query, sortable = ['createdAt'], defaultSort = '-createdAt') {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  const sort = {};
  const raw = query.sort || defaultSort;
  for (const part of String(raw).split(',')) {
    const field = part.replace(/^-/, '').trim();
    if (!sortable.includes(field)) {
      throw new AppError(400, 'INVALID_SORT', `Tri impossible sur "${field}" (autorisés : ${sortable.join(', ')})`);
    }
    sort[field] = part.startsWith('-') ? -1 : 1;
  }
  return { page, limit, skip: (page - 1) * limit, sort };
}

// Exécute une recherche paginée et renvoie { items, meta }
exports.paginate = async (Model, filter, query, opts = {}) => {
  const { page, limit, skip, sort } = parseQuery(query, opts.sortable, opts.defaultSort);
  let find = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (opts.select) find = find.select(opts.select);
  if (opts.populate) find = find.populate(opts.populate);

  const [items, total] = await Promise.all([find, Model.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

// Filtre de dates ?from=...&to=... sur un champ donné
exports.dateRange = (query, field) => {
  const range = {};
  if (query.from) {
    const d = new Date(query.from);
    if (isNaN(d)) throw new AppError(400, 'INVALID_DATE', '"from" n\'est pas une date valide');
    range.$gte = d;
  }
  if (query.to) {
    const d = new Date(query.to);
    if (isNaN(d)) throw new AppError(400, 'INVALID_DATE', '"to" n\'est pas une date valide');
    range.$lte = d;
  }
  return Object.keys(range).length ? { [field]: range } : {};
};
