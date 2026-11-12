require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const AppError = require('./utils/AppError');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

app.use((error, req, res, next) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Malformed JSON request body' },
    });
  }

  console.error('Unexpected server error');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
