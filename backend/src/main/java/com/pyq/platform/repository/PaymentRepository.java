package com.pyq.platform.repository;

import com.pyq.platform.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByOrderId(String orderId);
    List<Payment> findByStatus(String status);
    
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'SUCCESS'")
    BigDecimal findTotalRevenue();

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'SUCCESS' AND p.updatedAt >= :since")
    BigDecimal findRevenueSince(@Param("since") LocalDateTime since);

    @Query("SELECT p FROM Payment p WHERE p.status = 'SUCCESS' ORDER BY p.updatedAt DESC")
    List<Payment> findSuccessfulPayments();
}
