package com.pyq.platform.repository;

import com.pyq.platform.entity.PaymentVerification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentVerificationRepository extends JpaRepository<PaymentVerification, Long> {

    List<PaymentVerification> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<PaymentVerification> findFirstByUserIdAndStatusOrderByCreatedAtDesc(Long userId, PaymentVerification.Status status);

    Page<PaymentVerification> findByStatusOrderByCreatedAtDesc(PaymentVerification.Status status, Pageable pageable);

    Page<PaymentVerification> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query(value = "SELECT pv FROM PaymentVerification pv ORDER BY CASE WHEN pv.status = com.pyq.platform.entity.PaymentVerification.Status.PENDING THEN 0 ELSE 1 END, pv.createdAt DESC",
           countQuery = "SELECT COUNT(pv) FROM PaymentVerification pv")
    Page<PaymentVerification> findAllOrderedByPendingFirst(Pageable pageable);

    boolean existsByUtrNumber(String utrNumber);
}
