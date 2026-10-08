/**
 * ============================================================================
 * NEXUS PUBLISHER · FESTBLEND CUIABÁ 360
 * Motor Exclusivo de Mensageria, Webhooks Evolution API & Cloudflare D1
 * Porta Dedicada: 4070 (Modo Fork PM2 · Regra 1C e Regra 3A)
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20, timeout: 60000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20, timeout: 60000 });
axios.defaults.httpAgent = httpAgent;
axios.defaults.httpsAgent = httpsAgent;

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 4070;

const CF_ACCOUNT = process.env.CF_ACCOUNT || '952c2920af5b8e5db656b378e7a80b53';
const CF_TOKEN = process.env.CF_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const DB_FESTBLEND = process.env.DB_FESTBLEND || '780cd440-a787-4e85-9e26-f642c3852c0e';

const EVO_URL = process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080';
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const processedMessages = new Set();

// Regra Canônica 1G: Padronização Universal do 13º Dígito no Brasil
function normalizePhone(rawPhone) {
    if (!rawPhone) return '';
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('55')) {
        const ddd = digits.substring(2, 4);
        const rest = digits.substring(4);
        digits = '55' + ddd + '9' + rest;
    } else if (!digits.startsWith('55') && digits.length === 10) {
        const ddd = digits.substring(0, 2);
        const rest = digits.substring(2);
        digits = '55' + ddd + '9' + rest;
    } else if (!digits.startsWith('55') && digits.length === 11) {
        digits = '55' + digits;
    }
    return digits;
}

function formatPhoneDisplay(raw) {
    const digits = normalizePhone(raw);
    if (digits.length === 13 && digits.startsWith('55')) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return raw || '';
}

async function queryD1(sql, params = []) {
    try {
        const response = await axios.post(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${DB_FESTBLEND}/query`,
            { sql, params },
            {
                headers: {
                    'Authorization': `Bearer ${CF_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        return response.data?.result?.[0]?.results || response.data?.result || [];
    } catch (err) {
        console.error('[D1 QUERY ERR]:', err.response?.data || err.message);
        return [];
    }
}

async function transcribeAudioGroq(base64Data) {
    if (!GROQ_API_KEY) return null;
    try {
        const cleanBase64 = base64Data.replace(/^data:audio\/\w+;base64,/, '').replace(/^data:application\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const blob = new Blob([buffer], { type: 'audio/ogg' });

        const formData = new FormData();
        formData.append('file', blob, 'audio.ogg');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'pt');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
            body: formData
        });

        const data = await response.json();
        return data?.text ? data.text.trim() : null;
    } catch (err) {
        console.error('[GROQ TRANSCRIPTION ERR]:', err.message);
        return null;
    }
}

async function getMediaBase64FromEvolution(msgData, instanceName = 'fastblend') {
    try {
        const payloadMessage = (msgData && msgData.key && msgData.message) ? { key: msgData.key, message: msgData.message } : msgData;
        const res = await axios.post(`${EVO_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
            message: payloadMessage,
            convertToMp4: false
        }, {
            headers: { 'apiKey': EVO_KEY, 'Content-Type': 'application/json' },
            timeout: 25000
        });
        return res.data?.base64 || null;
    } catch (e) {
        return null;
    }
}

// Atribuição Inteligente de Vendedor (Larissa Noivas vs Matheus Corporativo vs Eduardo)
function determineAssignedSeller(text = '', currentAssigned = null) {
    if (currentAssigned && ['larissa', 'matheus', 'eduardo'].includes(currentAssigned)) {
        return currentAssigned;
    }
    const lower = text.toLowerCase();
    if (lower.includes('noiva') || lower.includes('casamento') || lower.includes('vestido') || lower.includes('cerimônia') || lower.includes('cerimonial')) {
        return 'larissa';
    }
    if (lower.includes('15 anos') || lower.includes('debutante') || lower.includes('corporativo') || lower.includes('empresa') || lower.includes('aniversário') || lower.includes('confraternização')) {
        return 'matheus';
    }
    return 'eduardo';
}

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'nexus-festblend-messaging',
        port: PORT,
        instance: 'fastblend',
        database: 'festblend-db',
        timestamp: new Date().toISOString()
    });
});

// Endpoint de Webhook da Evolution API
app.post('/webhook', async (req, res) => {
    // Responde 200 imediatamente para a Evolution API não reenviar
    res.status(200).json({ received: true });

    try {
        const body = req.body || {};
        const eventName = body.event;
        const instance = body.instance || 'fastblend';

        if (eventName !== 'MESSAGES_UPSERT' && eventName !== 'SEND_MESSAGE' && eventName !== 'MESSAGES_SET') {
            return;
        }

        let messageItems = [];
        if (eventName === 'MESSAGES_SET') {
            messageItems = Array.isArray(body.data) ? body.data : (body.data?.messages || []);
        } else if (body.data) {
            messageItems = [body.data];
        }

        for (const data of messageItems) {
            if (!data) continue;

            const messageId = data.key?.id;
            if (messageId) {
                if (processedMessages.has(messageId)) continue;
                processedMessages.add(messageId);
                if (processedMessages.size > 10000) processedMessages.clear();
            }

            const rawJid = data.key?.remoteJidAlt || data.key?.remoteJid || '';
            if (rawJid.endsWith('@g.us')) continue; // Ignora grupos

            const cleanPhone = normalizePhone(rawJid);
            if (!cleanPhone) continue;

            const fromMe = !!data.key?.fromMe;
            const direction = fromMe ? 'OUT' : 'IN';
            const pushName = data.pushName || (fromMe ? 'Festblend Cuiabá' : 'Cliente');
            const sender = fromMe ? 'Festblend' : pushName;
            const remoteJid = rawJid.includes('@') ? rawJid : `${cleanPhone}@s.whatsapp.net`;

            const msgObj = data.message || {};
            const isAudio = !!(msgObj.audioMessage);
            const isImage = !!(msgObj.imageMessage);

            let caption = msgObj.imageMessage?.caption || msgObj.videoMessage?.caption || '';
            let text = msgObj.conversation || msgObj.extendedTextMessage?.text || caption || '';
            let audioTranscription = null;
            let mediaType = 'text';

            if (isAudio) {
                mediaType = 'audio';
                try {
                    const base64Audio = await getMediaBase64FromEvolution(data, instance);
                    if (base64Audio) {
                        audioTranscription = await transcribeAudioGroq(base64Audio);
                        text = audioTranscription ? `[Áudio Transcrito]: ${audioTranscription}` : '[Mensagem de Áudio]';
                    } else {
                        text = '[Mensagem de Áudio]';
                    }
                } catch (e) {
                    text = '[Mensagem de Áudio]';
                }
            } else if (isImage) {
                mediaType = 'image';
                text = caption || '[Foto/Imagem enviada via WhatsApp]';
            }

            if (!text && !isAudio && !isImage) continue;

            let msgDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
            if (data.messageTimestamp) {
                const tsNumber = typeof data.messageTimestamp === 'number' ? data.messageTimestamp : parseInt(data.messageTimestamp);
                if (!isNaN(tsNumber) && tsNumber > 0) {
                    msgDate = new Date(tsNumber * 1000).toISOString().replace('T', ' ').substring(0, 19);
                }
            }

            // Verifica vendedor atual do contato no D1
            const contactRows = await queryD1('SELECT assigned_to, name FROM festblend_contacts WHERE phone = ? LIMIT 1;', [cleanPhone]);
            const currentAssigned = contactRows.length > 0 ? contactRows[0].assigned_to : null;
            const assignedTo = determineAssignedSeller(text, currentAssigned);

            // 1. Grava a mensagem na tabela festblend_conversations
            const insertMsgSql = `
                INSERT INTO festblend_conversations 
                (remote_jid, phone, push_name, sender, message, direction, media_type, media_url, audio_transcription, assigned_to, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            await queryD1(insertMsgSql, [
                remoteJid, cleanPhone, pushName, sender, text, direction, mediaType, null, audioTranscription, assignedTo, msgDate
            ]);

            // 2. Atualiza ou insere contato na tabela festblend_contacts
            if (contactRows.length > 0) {
                const updateContactSql = `
                    UPDATE festblend_contacts 
                    SET push_name = ?, assigned_to = ?, updated_at = datetime('now')
                    WHERE phone = ?;
                `;
                await queryD1(updateContactSql, [pushName, assignedTo, cleanPhone]);
            } else {
                const insertContactSql = `
                    INSERT INTO festblend_contacts 
                    (phone, remote_jid, name, push_name, avatar_url, event_type, deal_stage, assigned_to, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
                `;
                const defaultEventType = assignedTo === 'larissa' ? 'Casamento' : (assignedTo === 'matheus' ? 'Corporativo' : 'Evento 360');
                await queryD1(insertContactSql, [
                    cleanPhone, remoteJid, pushName, pushName, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', defaultEventType, 'data_consultada', assignedTo
                ]);
            }

            console.log(`[FESTBLEND MSG] ${direction} de ${cleanPhone} (${pushName}) -> Vendedor: ${assignedTo} | "${text.slice(0, 50)}"`);
        }
    } catch (err) {
        console.error('[FESTBLEND WEBHOOK ERR]:', err.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEXUS FESTBLEND MESSAGING] Servidor Online na Porta ${PORT} (Fork Mode)`);
    console.log(`[INSTÂNCIA ASSOCIADA] fastblend (Evolution API) -> D1 Database: ${DB_FESTBLEND}`);
});
