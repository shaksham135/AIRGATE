package com.pyq.platform.repository;

import com.pyq.platform.entity.GateTip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GateTipRepository extends JpaRepository<GateTip, Long> {
    List<GateTip> findByActiveTrueOrderByCreatedAtDesc();
    List<GateTip> findAllByOrderByCreatedAtDesc();
}
