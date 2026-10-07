// ============================================================
// FESTBLEND CRM · CLIENTE DE DADOS CLOUDFLARE D1
// Padrão Oficial: Aise Company & Nexus Publisher
// Zero Chaves Expostas no Front-end (Regra Global de Segurança)
// ============================================================

const D1_ENDPOINT = '/api/d1/query';

// Regra Canônica 1G: Padronização Universal do 13º Dígito no Brasil
function normalizePhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (!clean.startsWith('55') && clean.length >= 10 && clean.length <= 11) {
    clean = '55' + clean;
  }
  // Se for 55 + DDD (2 dig) + 8 dig = 12 dígitos, injeta o nono dígito '9'
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  return clean;
}

function formatPhoneDisplay(phone) {
  const clean = normalizePhone(phone);
  if (clean.length === 13) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  return phone;
}

async function queryD1(sql, params = []) {
  try {
    const res = await fetch(D1_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result && data.result[0] && data.result[0].results) {
        return data.result[0].results;
      }
      return data.result || [];
    }
  } catch (err) {
    console.warn('Proxy /api/d1/query em processamento:', err);
  }
  return [];
}
