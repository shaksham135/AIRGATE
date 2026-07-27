package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionRevisionRepository extends JpaRepository<QuestionRevision, Long> {
    List<QuestionRevision> findByQuestionIdOrderByEditedAtDesc(Long questionId);
}
