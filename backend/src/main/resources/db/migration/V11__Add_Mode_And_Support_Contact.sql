-- Migration V11: Add mode to mock_attempts and support contact fields to system_settings

ALTER TABLE mock_attempts 
ADD COLUMN mode VARCHAR(50) NULL;

ALTER TABLE system_settings 
ADD COLUMN support_email VARCHAR(255) NULL DEFAULT 'support@airgate.in',
ADD COLUMN support_phone VARCHAR(255) NULL DEFAULT '+91 (800) AIR-GATE';
