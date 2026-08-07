-- ⚡ Flyway Migration V26: Monetary Precision DECIMAL Migration

-- 1. Modify payments.amount column definition to DECIMAL(10, 2) for exact currency precision
ALTER TABLE payments 
MODIFY COLUMN amount DECIMAL(10, 2) NOT NULL;

-- 2. Modify system_settings price tier column definitions to DECIMAL(10, 2)
ALTER TABLE system_settings 
MODIFY COLUMN premium_price_inr DECIMAL(10, 2) NOT NULL DEFAULT 99.00,
MODIFY COLUMN tier1_price_inr DECIMAL(10, 2) NOT NULL DEFAULT 99.00,
MODIFY COLUMN tier2_price_inr DECIMAL(10, 2) NOT NULL DEFAULT 249.00,
MODIFY COLUMN tier3_price_inr DECIMAL(10, 2) NOT NULL DEFAULT 449.00;
