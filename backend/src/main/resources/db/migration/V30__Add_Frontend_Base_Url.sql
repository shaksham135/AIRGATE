-- Add frontend_base_url to system_settings table for dynamic email link control
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS frontend_base_url VARCHAR(255) DEFAULT 'https://airgate.in';
