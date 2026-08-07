-- ⚡ Ultra Fast Database Performance Indexes for Sub-20ms Question & Practice Queries

DROP PROCEDURE IF EXISTS add_idx_if_not_exists;

DELIMITER //
CREATE PROCEDURE add_idx_if_not_exists(
    IN tbl_name VARCHAR(64),
    IN idx_name VARCHAR(64),
    IN col_list VARCHAR(255)
)
BEGIN
    DECLARE idx_cnt INT;
    SELECT COUNT(*) INTO idx_cnt 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = tbl_name 
      AND INDEX_NAME = idx_name;

    IF idx_cnt = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', idx_name, ' ON ', tbl_name, '(', col_list, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL add_idx_if_not_exists('user_question_solves', 'idx_uqs_user_question', 'user_id, question_id');
CALL add_idx_if_not_exists('questions', 'idx_q_pdf_status_id', 'pdf_source_name, status, id DESC');
CALL add_idx_if_not_exists('questions', 'idx_q_status_subject', 'status, subject_id');
CALL add_idx_if_not_exists('questions', 'idx_q_status_topic', 'status, topic_id');
CALL add_idx_if_not_exists('questions', 'idx_q_status_diff', 'status, difficulty');
CALL add_idx_if_not_exists('questions', 'idx_q_status_type', 'status, question_type');

DROP PROCEDURE IF EXISTS add_idx_if_not_exists;
