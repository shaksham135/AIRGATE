-- V10: Add OTP fields for forgot password flow
ALTER TABLE users
    ADD COLUMN password_reset_otp VARCHAR(10) NULL,
    ADD COLUMN otp_expires_at DATETIME NULL;
