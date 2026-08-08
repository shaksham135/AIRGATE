-- ⚡ Ultra Fast Performance Indexes for VIP Beta Payments & GATE SEO Routing

CREATE INDEX idx_pv_utr ON payment_verifications(utr_number);
CREATE INDEX idx_pv_status_created ON payment_verifications(status, created_at);
CREATE INDEX idx_pv_user_status ON payment_verifications(user_id, status, created_at);
CREATE INDEX idx_q_seo_routing ON questions(branch, year, paper_set, question_number);
