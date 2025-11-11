import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pairRoute from './JS/pair.js';
import qrRoute from './JS/qr.js';

const app = express();
const PORT = process.env.PORT || 8000;

// ⚙️ Correction ESM : __dirname / __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes principales
app.use('/code', pairRoute);
app.use('/qr', qrRoute);

// Routes HTML (interface utilisateur)
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'html&css', 'pair.html'));
});

app.get('/qrcode', (req, res) => {
  res.sendFile(path.join(__dirname, 'html&css', 'qr.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'html&css', 'main.html'));
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).send('❌ Page non trouvée.');
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Feartherina lancé sur http://localhost:${PORT}`);
});