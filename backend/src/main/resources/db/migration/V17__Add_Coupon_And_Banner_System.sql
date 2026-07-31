-- V17__Add_Coupon_And_Banner_System.sql
-- Adds enterprise coupons, redemption audit tracking, and dynamic admin announcement ad banners

CREATE TABLE IF NOT EXISTS coupons (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL, -- PERCENTAGE, FLAT
    discount_value DECIMAL(10,2) NOT NULL,
    applicable_tier VARCHAR(20) NOT NULL, -- MONTHLY, QUARTERLY, SEASON, ANNUAL, ALL
    max_uses INT DEFAULT 100,
    current_uses INT DEFAULT 0,
    max_uses_per_user INT DEFAULT 1,
    min_order_amount DECIMAL(10,2) DEFAULT 0.00,
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_until DATETIME NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coupon_code (code),
    INDEX idx_coupon_active (active)
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    coupon_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    order_amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    final_amount DECIMAL(10,2) NOT NULL,
    redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cr_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cr_user_coupon (user_id, coupon_id)
);

CREATE TABLE IF NOT EXISTS promo_banners (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    cta_text VARCHAR(50) DEFAULT 'Claim Offer',
    cta_link VARCHAR(255) DEFAULT '/pricing',
    coupon_code VARCHAR(50) NULL,
    banner_type VARCHAR(50) DEFAULT 'HEADER_BAR', -- HEADER_BAR, CARD_POPUP
    bg_color VARCHAR(50) DEFAULT '#8b5cf6',
    text_color VARCHAR(50) DEFAULT '#ffffff',
    active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    valid_until DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_banner_active (active)
);
