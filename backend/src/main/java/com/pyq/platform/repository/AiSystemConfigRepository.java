package com.pyq.platform.repository;

import com.pyq.platform.entity.AiSystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiSystemConfigRepository extends JpaRepository<AiSystemConfig, String> {
    List<AiSystemConfig> findByCategory(String category);
}
