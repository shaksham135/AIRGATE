-- V19__Add_Email_Automation_Settings.sql
-- Adds Admin Email Automation Controls for Welcome & 24h Drip Nudge Emails

ALTER TABLE system_settings 
ADD COLUMN auto_welcome_email_enabled TINYINT(1) NOT NULL DEFAULT 1,
ADD COLUMN auto_drip_offer_email_enabled TINYINT(1) NOT NULL DEFAULT 1;
