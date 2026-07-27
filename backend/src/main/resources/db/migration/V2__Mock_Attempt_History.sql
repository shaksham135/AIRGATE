-- V2: Mock Attempt History Tables
CREATE TABLE mock_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    started_at DATETIME(6) NOT NULL,
    submitted_at DATETIME(6) NOT NULL,
    time_taken_seconds INT NOT NULL,
    total_questions INT NOT NULL,
    correct_count INT NOT NULL DEFAULT 0,
    incorrect_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    score DOUBLE NOT NULL DEFAULT 0.0,
    negative_wastage DOUBLE NOT NULL DEFAULT 0.0,
    auto_submitted BIT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_mock_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE mock_attempt_answers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    selected_answer VARCHAR(512),
    is_correct BIT(1) NOT NULL DEFAULT 0,
    marks_awarded DOUBLE NOT NULL DEFAULT 0.0,
    PRIMARY KEY (id),
    CONSTRAINT fk_maa_attempt FOREIGN KEY (attempt_id) REFERENCES mock_attempts(id) ON DELETE CASCADE,
    CONSTRAINT fk_maa_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
