-- ⚡ Flyway Migration V29: Add 3-Month and 6-Month Beta Pricing Columns

ALTER TABLE system_settings 
ADD COLUMN beta_tier3_price DECIMAL(10, 2) DEFAULT 249.00,
ADD COLUMN beta_tier3_offer VARCHAR(255);
