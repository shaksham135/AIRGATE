-- ⚡ Flyway Migration V28: Add Marketing Banner & Offer Columns to System Settings

ALTER TABLE system_settings 
ADD COLUMN beta_banner_heading VARCHAR(255),
ADD COLUMN beta_banner_subheading TEXT,
ADD COLUMN beta_tier1_offer VARCHAR(255),
ADD COLUMN beta_tier2_offer VARCHAR(255);
