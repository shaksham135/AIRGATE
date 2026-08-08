-- ⚡ Ultra Fast Performance Indexes for VIP Beta Payments & GATE SEO Routing

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

-- Payment verification indexes
CALL add_idx_if_not_exists('payment_verifications', 'idx_pv_utr', 'utr_number');
CALL add_idx_if_not_exists('payment_verifications', 'idx_pv_status_created', 'status, created_at DESC');
CALL add_idx_if_not_exists('payment_verifications', 'idx_pv_user_status', 'user_id, status, created_at DESC');

-- Questions SEO routing compound index
CALL add_idx_if_not_exists('questions', 'idx_q_seo_routing', 'branch, year, paper_set, question_number');

DROP PROCEDURE IF EXISTS add_idx_if_not_exists;
