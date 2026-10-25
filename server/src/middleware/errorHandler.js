function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express recognizes an error handler by its 4 parameters, so keep all four even though `next` is unused
function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
}

export { notFound, errorHandler };