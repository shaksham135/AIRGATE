package com.pyq.platform.repository;

import com.pyq.platform.entity.PromoBanner;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PromoBannerRepository extends JpaRepository<PromoBanner, Long> {

    List<PromoBanner> findByActiveTrueOrderByPriorityDescCreatedAtDesc();

    List<PromoBanner> findAllByOrderByPriorityDescCreatedAtDesc();
}
