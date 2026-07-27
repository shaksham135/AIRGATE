-- V9: Create Email Logs table for tracking automated & broadcast email notifications
CREATE TABLE IF NOT EXISTS email_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(512) NOT NULL,
    email_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SENT',
    sent_at DATETIME NOT NULL,
    error_message TEXT,
    INDEX idx_recipient (recipient_email),
    INDEX idx_sent_at (sent_at),
    INDEX idx_email_type (email_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
