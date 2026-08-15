-- Flyway Migration V35: Add dynamic token limits for AI Tutor and Background Solution Derivations
INSERT INTO system_settings (setting_key, setting_value, category, description) VALUES
('ai_tutor_max_tokens', '2000', 'AI', 'Maximum output tokens generated per AI Tutor chat request'),
('ai_solution_max_tokens', '3500', 'AI', 'Maximum output tokens generated per detailed solution derivation')
ON DUPLICATE KEY UPDATE setting_key=setting_key;
