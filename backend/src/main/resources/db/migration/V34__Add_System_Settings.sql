-- Flyway Migration V34: Create system_settings table for dynamic AI models & API key configuration
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'AI',
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial default AI settings
INSERT INTO system_settings (setting_key, setting_value, category, description) VALUES
('groq_fast_model', 'llama-3.3-70b-versatile', 'AI', 'Fast Model for Question Parsing, Classification & Ingestion'),
('groq_heavy_model', 'llama-3.3-70b-versatile', 'AI', 'Heavy Model for AI Practice Generator & Solution Derivations'),
('groq_api_url', 'https://api.groq.com/openai/v1/chat/completions', 'AI', 'Groq API Endpoint URL'),
('ai_tutor_model', 'llama-3.3-70b-versatile', 'AI', 'AI Tutor Chat Assistant Model Name'),
('ai_tutor_api_url', 'https://api.groq.com/openai/v1/chat/completions', 'AI', 'AI Tutor API Endpoint URL'),
('groq_api_keys', '', 'AI', 'Comma or newline-separated Groq API Keys for Round-Robin Load Balancing')
ON DUPLICATE KEY UPDATE setting_key=setting_key;
