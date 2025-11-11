import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import NodeCache from 'node-cache';
import {
  default as makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';
import { toDataURL } from 'qrcode';

const app = express.Router();
const msgRetryCounterCache = new NodeCache();
let sock;

const __dirname = path.resolve();
const sessionDir = path.join(__dirname, 'session');

app.get('/', async (req, res) => {
  await ovl(req, res);
});

async function ovl(req, res, disconnect = false) {
  await feartherina(req, res, disconnect);
}

async function feartherina(req, res, disconnect = false) {
  if (!disconnect && !fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS('Safari'),
    markOnlineOnConnect: true,
    msgRetryCounterCache
  });

  const qrOptions = {
    width: Number(req.query.width) || 270,
    height: Number(req.query.height) || 270,
    color: {
      dark: req.query.darkColor || '#000000',
      light: req.query.lightColor || '#ffffff'
    }
  };

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !disconnect) {
      try {
        const qrDataURL = await toDataURL(qr, qrOptions);
        const data = qrDataURL.split(',')[1];
        if (!res.headersSent) {
          res.send(data);
        }
      } catch (err) {
        console.error('❌ Erreur QR code :', err);
        if (!res.headersSent) {
          res.status(500).send('Erreur lors de la génération du QR code');
        }
      }
    }

    if (connection === 'open') {
      console.log('✅ Connecté aux serveurs WhatsApp');
      await delay(5000);

      try {
        const CREDS = fs.readFileSync(`${sessionDir}/creds.json`, 'utf-8');
        const response = await axios.post('https://pastebin.com/api/api_post.php', new URLSearchParams({
          api_dev_key: '8SVAvrcVzxkPEJsluSdmLBALAHzrhopQ',
          api_option: 'paste',
          api_paste_code: CREDS,
          api_paste_expire_date: 'N'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const lienPastebin = response.data.split('/')[3];
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');

        console.log(`
📞 Utilisateur   : ${sock.user.id}
🔐 SESSION_ID    : Feartherina-BOT_${lienPastebin}_SESSION-ID
🔗 Pastebin      : https://pastebin.com/${lienPastebin}
📅 Date          : ${dateStr}
🕒 Heure         : ${timeStr}
`);

        const msg = await sock.sendMessage(sock.user.id, {
          text: `Feartherina-BOT_${lienPastebin}_SESSION-ID`
        });

        await sock.sendMessage(sock.user.id, {
          text: '🎉 Session générée avec succès ✅🔼'
        }, { quoted: msg });

        await sock.groupAcceptInvite('DbnJGPwfyseF8ejtYvnLum');
        await sock.groupAcceptInvite('EkFLPBI2BQr7wVeckwqJIF');
      } catch (err) {
        console.error('Erreur d’upload :', err);
      } finally {
        await delay(1000);
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      reconnect(reason, req, res);
    }
  });
}

function reconnect(reason, req, res) {
  if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
    console.log('⚠️ Connexion perdue, reconnexion en cours...');
    ovl(req, res, true);
  } else {
    console.log(`❌ Déconnecté (motif : ${reason})`);
    if (sock) sock.end();
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export default app;