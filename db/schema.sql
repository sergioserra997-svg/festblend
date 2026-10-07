-- ============================================================
-- FESTBLEND CRM · ESQUEMA RELACIONAL CANÔNICO CLOUDFLARE D1
-- Banco de Dados: festblend-db (UUID: 780cd440-a787-4e85-9e26-f642c3852c0e)
-- Isolamento Estrito: Regra 1C (Zero cruzamento com outros clientes)
-- ============================================================

CREATE TABLE IF NOT EXISTS festblend_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'vendedor', -- 'admin' ou 'vendedor'
    avatar_url TEXT,
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS festblend_contacts (
    phone TEXT PRIMARY KEY,
    remote_jid TEXT,
    name TEXT,
    push_name TEXT,
    avatar_url TEXT,
    event_type TEXT, -- 'Casamento', '15 Anos', 'Formatura', 'Corporativo', 'Aniversário'
    event_date TEXT, -- 'AAAA-MM-DD'
    event_location TEXT, -- Espaço / Buffet em Cuiabá
    guest_count INTEGER,
    menu_type TEXT,
    deal_stage TEXT DEFAULT 'data_consultada',
    deal_value REAL DEFAULT 0.0,
    down_payment REAL DEFAULT 0.0,
    assigned_to TEXT DEFAULT 'eduardo',
    urgency_level TEXT DEFAULT 'normal', -- 'normal', 'alta', 'critica_data_em_risco'
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS festblend_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remote_jid TEXT NOT NULL,
    phone TEXT NOT NULL,
    push_name TEXT,
    sender TEXT,
    message TEXT,
    direction TEXT, -- 'IN' ou 'OUT'
    media_type TEXT, -- 'text', 'audio', 'image', 'document'
    media_url TEXT,
    audio_transcription TEXT,
    assigned_to TEXT DEFAULT 'eduardo',
    is_read INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS festblend_pipeline_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    remote_jid TEXT,
    client_name TEXT,
    event_type TEXT,
    event_date TEXT,
    guest_count INTEGER,
    stage TEXT NOT NULL,
    deal_value REAL DEFAULT 0.0,
    assigned_to TEXT DEFAULT 'eduardo',
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS festblend_date_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date TEXT NOT NULL,
    client_name TEXT,
    phone TEXT,
    assigned_to TEXT,
    status TEXT DEFAULT 'pendente', -- 'pendente', 'fechado', 'perdido'
    alert_message TEXT,
    days_until_event INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
