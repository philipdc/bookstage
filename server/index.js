require('dotenv').config();
const express = require('express');
const path    = require('path');

const accountsRouter = require('./routes/accounts');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API routes
app.use('/api/accounts', accountsRouter);

// Serve built React app in web/production mode
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`BookStage server running on http://localhost:${PORT}`);
});
