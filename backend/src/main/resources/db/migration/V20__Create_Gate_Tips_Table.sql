-- Migration V20: Create gate_tips table for dynamic loader motivation and micro-tips
CREATE TABLE IF NOT EXISTS gate_tips (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    text VARCHAR(500) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_gate_tips_active ON gate_tips(is_active);
