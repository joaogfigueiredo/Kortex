-- Kortex — Schema relacional (SQLite)
-- Conexão: PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;

-- ========== CONFIG ==========
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,          -- 'theme', 'pin_hash', 'locale', 'week_start'...
  value TEXT NOT NULL
);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6FE3FF'
);

-- Ligação genérica de tags a qualquer entidade
CREATE TABLE entity_tags (
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('idea','project','finance','reminder','study')),
  entity_id   INTEGER NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

-- ========== A. IDEIAS ==========
CREATE TABLE ideas (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'organized'
               CHECK (status IN ('organized','started','developing','done')),
  priority     INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  position     REAL NOT NULL DEFAULT 0,
  promoted_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, -- ideia virou projeto
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);
CREATE INDEX idx_ideas_status_pos ON ideas(status, position);

-- ========== B. LEMBRETES ==========
CREATE TABLE reminder_categories (            -- cores das "bolinhas" do calendário
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,                 -- Trabalho, Saúde, Pessoal, Estudo...
  color TEXT NOT NULL
);

CREATE TABLE reminders (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  kind          TEXT NOT NULL DEFAULT 'reminder'
                CHECK (kind IN ('reminder','appointment','notice')),  -- lembrete / compromisso / aviso
  category_id   INTEGER REFERENCES reminder_categories(id) ON DELETE SET NULL,
  start_at      TEXT NOT NULL,              -- horário LOCAL "flutuante": YYYY-MM-DDTHH:mm (sem fuso)
  end_at        TEXT,                       -- idem; >= start_at
  all_day       INTEGER NOT NULL DEFAULT 0,
  recurrence    TEXT NOT NULL DEFAULT 'none'
                CHECK (recurrence IN ('none','daily','weekly','monthly')),
  recurrence_weekdays INTEGER,                -- bitmask Dom=1..Sáb=64 (p/ weekly)
  recurrence_until    TEXT,
  notify_minutes_before INTEGER,
  done          INTEGER NOT NULL DEFAULT 0,   -- p/ não recorrentes
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_reminders_start ON reminders(start_at);

CREATE TABLE reminder_completions (           -- conclusão por ocorrência (recorrentes)
  reminder_id     INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,              -- YYYY-MM-DD
  completed_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (reminder_id, occurrence_date)
);

-- ========== C. PROJETOS ==========
CREATE TABLE projects (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'idea'
               CHECK (status IN ('idea','started','development','done','deployed')),
  dev_level    INTEGER CHECK (dev_level IN (1,2,3)),  -- obrigatório só quando status='development'
  position     REAL NOT NULL DEFAULT 0,
  repo_url     TEXT,
  deploy_url   TEXT,
  started_at   TEXT,
  finished_at  TEXT,
  deployed_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK ((status = 'development') = (dev_level IS NOT NULL))
);
CREATE INDEX idx_projects_col ON projects(status, dev_level, position);

-- ========== D. ATIVIDADES FINANCEIRAS ==========
CREATE TABLE finance_activities (
  id             INTEGER PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'idea'
                 CHECK (status IN ('idea','development','active')),
  kind           TEXT NOT NULL DEFAULT 'business'
                 CHECK (kind IN ('job','freelance','business','content','investment','other')),
  expected_monthly_cents INTEGER,
  actual_monthly_cents   INTEGER,
  currency       TEXT NOT NULL DEFAULT 'BRL',
  position       REAL NOT NULL DEFAULT 0,
  project_id     INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Histórico / observações / avisos exibidos no modal do card
CREATE TABLE finance_entries (
  id           INTEGER PRIMARY KEY,
  activity_id  INTEGER NOT NULL REFERENCES finance_activities(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('note','edit','status_change','alert')),
  content      TEXT NOT NULL,
  meta         TEXT,                          -- JSON (ex.: {"from":"idea","to":"development"})
  due_at       TEXT,                          -- p/ alertas
  resolved     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_fin_entries_act ON finance_entries(activity_id, created_at);

-- ========== E. ESTUDOS ==========
CREATE TABLE study_subjects (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT NOT NULL DEFAULT '#6FE3FF',
  level        TEXT NOT NULL DEFAULT 'beginner'
               CHECK (level IN ('beginner','intermediate','advanced')),
  progress     INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_hours REAL,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- "última vez estudada" = MAX(time_entries.started_at) WHERE module='study'

-- ========== TEMPO (base do Dashboard + Modo Foco) ==========
CREATE TABLE time_entries (
  id           INTEGER PRIMARY KEY,
  module       TEXT NOT NULL CHECK (module IN ('study','idea','project','finance','work','other')),
  ref_id       INTEGER,                        -- id da entidade (subject, idea, project...)
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','focus')),
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_time_module_date ON time_entries(module, started_at);
CREATE INDEX idx_time_ref ON time_entries(module, ref_id);

-- ========== SAÚDE: TREINOS & DIETA ==========
CREATE TABLE workouts (
  id           INTEGER PRIMARY KEY,
  date         TEXT NOT NULL,                  -- YYYY-MM-DD
  type         TEXT NOT NULL,                  -- musculação, corrida, ...
  duration_min INTEGER,
  intensity    INTEGER CHECK (intensity BETWEEN 1 AND 5),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_workouts_date ON workouts(date);

CREATE TABLE meal_plan (                       -- refeições planejadas (template)
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,                  -- Café, Almoço...
  time         TEXT,                           -- HH:MM
  description  TEXT,                           -- o que comer
  weekdays     INTEGER NOT NULL DEFAULT 127,   -- bitmask, 127 = todos os dias
  position     REAL NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE meal_logs (
  meal_id      INTEGER NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('done','partial','skipped')),
  note         TEXT,
  PRIMARY KEY (meal_id, date)
);

-- ========== METAS DIÁRIAS ==========
CREATE TABLE daily_goals (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  weekdays     INTEGER NOT NULL DEFAULT 127,   -- bitmask (diária = 127)
  icon         TEXT,
  position     REAL NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE goal_checks (
  goal_id      INTEGER NOT NULL REFERENCES daily_goals(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  checked_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (goal_id, date)
);
