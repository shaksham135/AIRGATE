-- V3: Add premium_expires_at column to users table for subscription cycle tracking
ALTER TABLE users ADD COLUMN premium_expires_at DATETIME NULL;
