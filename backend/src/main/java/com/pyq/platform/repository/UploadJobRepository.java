package com.pyq.platform.repository;

import com.pyq.platform.entity.UploadJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UploadJobRepository extends JpaRepository<UploadJob, Long> {
    List<UploadJob> findByCreatedByIdOrderByCreatedAtDesc(Long userId);
    List<UploadJob> findAllByOrderByCreatedAtDesc();
    // Used by BackgroundSolutionGenerator to pause while a PDF upload is in progress
    boolean existsByStatusIn(java.util.List<String> statuses);

}
