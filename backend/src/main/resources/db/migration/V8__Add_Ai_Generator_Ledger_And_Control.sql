-- Flyway Migration V8: AI Generator Ledger and Control Settings

-- 1. Create AI Generation Ledger table for dynamic subject/topic balancing
CREATE TABLE IF NOT EXISTS ai_generation_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    topic_id BIGINT NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    question_type VARCHAR(10) NOT NULL DEFAULT 'MCQ',
    total_generated INT DEFAULT 0,
    total_accepted INT DEFAULT 0,
    total_rejected INT DEFAULT 0,
    last_generated_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    UNIQUE KEY uk_subject_topic_diff_type (subject_id, topic_id, difficulty, question_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add difficulty column to questions table if not exists
SET @exist_diff := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'questions' 
      AND COLUMN_NAME = 'difficulty'
);
SET @sql_diff := IF(@exist_diff = 0, 
    'ALTER TABLE questions ADD COLUMN difficulty VARCHAR(20) NOT NULL DEFAULT \'MEDIUM\' AFTER question_type', 
    'SELECT "Column difficulty already exists"'
);
PREPARE stmt FROM @sql_diff;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add AI generator settings to system_settings table if not present
SET @exist_ai_enabled := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'system_settings' 
      AND COLUMN_NAME = 'ai_generator_enabled'
);
SET @sql_ai_enabled := IF(@exist_ai_enabled = 0, 
    'ALTER TABLE system_settings ADD COLUMN ai_generator_enabled BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN ai_generator_start_hour INT NOT NULL DEFAULT 0, ADD COLUMN ai_generator_end_hour INT NOT NULL DEFAULT 4', 
    'SELECT "AI Generator settings already exist"'
);
PREPARE stmt FROM @sql_ai_enabled;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
