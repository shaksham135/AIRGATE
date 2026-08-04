package com.pyq.platform.repository;

import com.pyq.platform.entity.BugReport;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BugReportRepository extends JpaRepository<BugReport, Long> {
    @EntityGraph(attributePaths = { "user" })
    List<BugReport> findAllByOrderByCreatedAtDesc();
}
