-- Flyway Migration V5
-- Description: Advanced User Management, AI Pipeline Costs, Settings, and Bug Tracking

-- 1. Create login_histories table
CREATE TABLE IF NOT EXISTS login_histories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser VARCHAR(50),
    operating_system VARCHAR(50),
    device_type VARCHAR(50),
    logged_in_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT NOT NULL PRIMARY KEY,
    premium_price_inr DOUBLE NOT NULL DEFAULT 99.0,
    premium_duration_months INT NOT NULL DEFAULT 1,
    ai_daily_limit_premium INT NOT NULL DEFAULT 50,
    is_maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default settings row
INSERT INTO system_settings (id, premium_price_inr, premium_duration_months, ai_daily_limit_premium, is_maintenance_mode)
VALUES (1, 99.0, 1, 50, FALSE)
ON DUPLICATE KEY UPDATE id=id;

-- 3. Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    page_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_bug_report_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Alter users table to track streaks
ALTER TABLE users 
ADD COLUMN current_streak INT NOT NULL DEFAULT 0,
ADD COLUMN longest_streak INT NOT NULL DEFAULT 0,
ADD COLUMN last_solved_date DATE NULL;

-- 5. Alter ai_requests table to track detailed metadata for cost analysis
ALTER TABLE ai_requests
ADD COLUMN model_name VARCHAR(50) NULL,
ADD COLUMN prompt_tokens INT NOT NULL DEFAULT 0,
ADD COLUMN completion_tokens INT NOT NULL DEFAULT 0,
ADD COLUMN topic_name VARCHAR(100) NULL;
