// ============================================================
// FESTBLEND CRM · SISTEMA DE AUTENTICAÇÃO E CONTROLE RBAC
// Padrão Oficial: Aise Company & Nexus Publisher
// ============================================================

const FESTBLEND_AUTH_KEY = 'festblend_auth_session';

const FESTBLEND_PRESET_USERS = {
  'eduardo@festblend.com.br': {
    id: 'eduardo',
    slug: 'carlos',
    name: 'Carlos Eduardo (Dudu)',
    role: 'admin',
    title: 'Diretor Geral & Proprietário',
    email: 'eduardo@festblend.com.br',
    avatar: 'assets/carlos_eduardo.png',
    permissions: ['all_chats', 'financials', 'date_radar', 'settings', 'reassign_leads']
  },
  'carlos@festblend.com.br': {
    id: 'eduardo',
    slug: 'carlos',
    name: 'Carlos Eduardo (Dudu)',
    role: 'admin',
    title: 'Diretor Geral & Proprietário',
    email: 'carlos@festblend.com.br',
    avatar: 'assets/carlos_eduardo.png',
    permissions: ['all_chats', 'financials', 'date_radar', 'settings', 'reassign_leads']
  },
  'anapaula@festblend.com.br': {
    id: 'anapaula',
    slug: 'anapaula',
    name: 'Ana Paula Serra',
    role: 'vendedor',
    title: 'Closer Vendas & Financeiro',
    email: 'anapaula@festblend.com.br',
    avatar: 'assets/ana_paula.png',
    permissions: ['own_chats', 'own_kanban', 'financials']
  },
  'ana@festblend.com.br': {
    id: 'anapaula',
    slug: 'anapaula',
    name: 'Ana Paula Serra',
    role: 'vendedor',
    title: 'Closer Vendas & Financeiro',
    email: 'anapaula@festblend.com.br',
    avatar: 'assets/ana_paula.png',
    permissions: ['own_chats', 'own_kanban', 'financials']
  },
  'ruben@festblend.com.br': {
    id: 'ruben',
    slug: 'ruben',
    name: 'Ruben Ribeiro',
    role: 'vendedor',
    title: 'Closer Comercial & Eventos',
    email: 'ruben@festblend.com.br',
    avatar: 'assets/ruben_ribeiro.png',
    permissions: ['own_chats', 'own_kanban']
  }
};

function getFestblendSession() {
  try {
    const raw = localStorage.getItem(FESTBLEND_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setFestblendSession(sessionData) {
  if (sessionData && !sessionData.token) {
    sessionData.token = 'festblend_active_' + (sessionData.id || 'usr') + '_' + Date.now().toString(36);
  }
  localStorage.setItem(FESTBLEND_AUTH_KEY, JSON.stringify(sessionData));
}

function checkFestblendAuth(targetRole = null) {
  const session = getFestblendSession();
  if (!session || !session.id) {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    if (!current.includes('login.html')) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    }
    return null;
  }

  if (targetRole && session.role !== targetRole && session.role !== 'admin') {
    alert('Acesso restrito à Diretoria Festblend.');
    window.location.href = 'festblend_mod_chats.html';
    return null;
  }

  // Ocultar elementos restritos no DOM com base na role
  applyRoleVisibility(session.role);
  return session;
}

function applyRoleVisibility(role) {
  document.querySelectorAll('[data-role-restrict]').forEach(el => {
    const requiredRole = el.getAttribute('data-role-restrict');
    if (requiredRole === 'admin' && role !== 'admin') {
      el.style.display = 'none';
    } else {
      el.style.display = '';
    }
  });
}

function festblendLogout() {
  localStorage.removeItem(FESTBLEND_AUTH_KEY);
  if (window.top && window.top !== window) {
    window.top.location.href = 'login.html';
  } else {
    window.location.href = 'login.html';
  }
}

// Auto-execução ao carregar se estiver em página interna
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop();
    if (page && !page.includes('login.html') && !page.includes('index.html')) {
      checkFestblendAuth();
    }
  });
}
