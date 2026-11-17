// Format de réponse homogène : { success, data, meta? }
exports.ok = (res, data, meta) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
};

exports.created = (res, data) => res.status(201).json({ success: true, data });

exports.noContent = (res) => res.status(204).send();
