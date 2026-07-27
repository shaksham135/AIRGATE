-- Flyway Migration V7
-- Description: Add Dynamic SEO, Google Site Verification, and Umami Analytics fields to system_settings

ALTER TABLE system_settings
ADD COLUMN seo_site_title VARCHAR(255) NULL,
ADD COLUMN seo_meta_description VARCHAR(1000) NULL,
ADD COLUMN seo_keywords VARCHAR(255) NULL,
ADD COLUMN google_site_verification VARCHAR(255) NULL,
ADD COLUMN umami_website_id VARCHAR(255) NULL;
