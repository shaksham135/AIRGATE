-- ⚡ Flyway Migration V25: Payment Idempotency Unique Constraints

-- 1. Unique Constraint on order_id: Prevents duplicate payment order creation and guarantees webhook idempotency
CREATE UNIQUE INDEX uk_payments_order_id ON payments(order_id);

-- 2. Unique Constraint on payment_id: Prevents duplicate verification entries when gateways issue retry events
CREATE UNIQUE INDEX uk_payments_payment_id ON payments(payment_id);
