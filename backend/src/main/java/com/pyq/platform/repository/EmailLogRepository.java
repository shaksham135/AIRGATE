package com.pyq.platform.repository;

import com.pyq.platform.entity.EmailLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmailLogRepository extends JpaRepository<EmailLog, Long> {
    List<EmailLog> findTop50ByOrderBySentAtDesc();
    long countByEmailType(String emailType);
    long countByEmailTypeContaining(String keyword);
    boolean existsByRecipientEmailAndEmailType(String recipientEmail, String emailType);
}
