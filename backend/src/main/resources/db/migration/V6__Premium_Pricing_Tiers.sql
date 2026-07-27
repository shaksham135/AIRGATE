-- Flyway Migration V6
-- Description: Dynamic Multi-Tier Pricing Packages and Special Offers

ALTER TABLE system_settings
ADD COLUMN tier1_price_inr DOUBLE NOT NULL DEFAULT 99.0,
ADD COLUMN tier1_duration_months INT NOT NULL DEFAULT 1,
ADD COLUMN tier1_special_offer VARCHAR(255) NULL DEFAULT 'Best for quick revisions',
ADD COLUMN tier2_price_inr DOUBLE NOT NULL DEFAULT 249.0,
-- Set default to 3 months
ADD COLUMN tier2_duration_months INT NOT NULL DEFAULT 3,
ADD COLUMN tier2_special_offer VARCHAR(255) NULL DEFAULT 'Save 15% - Most Popular',
ADD COLUMN tier3_price_inr DOUBLE NOT NULL DEFAULT 449.0,
-- Set default to 6 months
ADD COLUMN tier3_duration_months INT NOT NULL DEFAULT 6,
ADD COLUMN tier3_special_offer VARCHAR(255) NULL DEFAULT 'Save 25% - Complete Prep';

UPDATE system_settings
SET tier1_price_inr = premium_price_inr,
    tier1_duration_months = premium_duration_months
WHERE id = 1;
