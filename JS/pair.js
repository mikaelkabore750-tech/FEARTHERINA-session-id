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

const app = express.Router();
const msgRetryCounterCache = new NodeCache();
const PORT = process.env.PORT || 3000;
let sock;

const __dirname = path.resolve();
const sessionDir = path.join(__dirname, 'session');

app.get('/', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.json({ error: 'Veuillez fournir un numéro de téléphone' });
  await ovl(num, res);
});

async function ovl(num, res, disconnect = false) {
  await feartherina(num, res, disconnect);
}

async function feartherina(num, res, disconnect = false) {
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
    browser: Browsers.macOS("Safari"),
    markOnlineOnConnect: true,
    msgRetryCounterCache
  });

  sock.ev.on('creds.update', saveCreds);

  const isFirstLogin = !sock.authState.creds.registered;

  if (isFirstLogin && !disconnect) {
    await delay(1500);
    const numero = num.replace(/[^0-9]/g, '');
    const code = await sock.requestPairingCode(numero);
    if (!res.headersSent) res.send({ code });
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
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
📞 Numéro       : ${num}
🆔 Wa_id        : http://wa.me/${num}
🔐 SESSION_ID   : Feartherina-BOT_${lienPastebin}_SESSION-ID
🔗 Pastebin     : https://pastebin.com/${lienPastebin}
📅 Date         : ${dateStr}
🕒 Heure        : ${timeStr}
`);

        const msg = await sock.sendMessage(sock.user.id, { text: `Feqrtherina-BOT_${lienPastebin}_SESSION-ID` });

        await sock.sendMessage(sock.user.id, {
          text: "🎉 Session générée avec succès !",
        }, { quoted: msg });

        await sock.groupAcceptInvite("EkFLPBI2BQr7wVeckwqJIF");
        await sock.groupAcceptInvite("DbnJGPwfyseF8ejtYvnLum");

        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Erreur d’upload :', err);
      }
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      reconnect(reason, num, res);
    }
  });
}

function reconnect(reason, num, res) {
  if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
    console.log('Connexion perdue, reconnexion en cours...');
    ovl(num, res, true);
  } else {
    console.log(`Déconnecté ! Motif : ${reason}`);
    if (sock) sock.end();
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export default app;