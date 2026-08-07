-- ⚡ Flyway Migration V27: Add SEO Routing Columns & VIP Beta Payment System

-- 1. Add SEO Routing columns to questions table
ALTER TABLE questions 
ADD COLUMN branch VARCHAR(32) DEFAULT 'cse',
ADD COLUMN paper_set INT DEFAULT 1,
ADD COLUMN question_number INT;

-- 2. Add VIP Beta Payment columns to system_settings table
ALTER TABLE system_settings 
ADD COLUMN beta_payment_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN beta_upi_id VARCHAR(255) DEFAULT 'airgate@upi',
ADD COLUMN beta_qr_image_url TEXT,
ADD COLUMN beta_spots_remaining INT DEFAULT 100,
ADD COLUMN beta_tier1_price DECIMAL(10, 2) DEFAULT 49.00,
ADD COLUMN beta_tier2_price DECIMAL(10, 2) DEFAULT 249.00;

-- 3. Create payment_verifications table for manual UPI verification requests
CREATE TABLE IF NOT EXISTS payment_verifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_type VARCHAR(64) NOT NULL,
    duration_months INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    utr_number VARCHAR(64) NOT NULL,
    screenshot_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    CONSTRAINT fk_payment_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
