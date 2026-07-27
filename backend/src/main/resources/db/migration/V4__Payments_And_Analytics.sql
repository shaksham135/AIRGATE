-- Add last_active_at to users table to track DAU/MAU
ALTER TABLE users ADD COLUMN last_active_at DATETIME(6);

-- Create payments table to log Razorpay transactions and track revenue
CREATE TABLE payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    order_id VARCHAR(100) NOT NULL,
    payment_id VARCHAR(100),
    signature VARCHAR(255),
    amount DOUBLE NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL, -- 'CREATED', 'SUCCESS', 'FAILED'
    duration_months INT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create ai_requests table to track usage of the AI Tutor
CREATE TABLE ai_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    requested_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ai_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
