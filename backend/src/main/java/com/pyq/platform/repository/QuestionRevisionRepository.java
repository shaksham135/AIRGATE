package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionRevisionRepository extends JpaRepository<QuestionRevision, Long> {
    List<QuestionRevision> findByQuestionIdOrderByEditedAtDesc(Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM QuestionRevision qr WHERE qr.question.id = :questionId")
    void deleteByQuestionId(@org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM QuestionRevision qr WHERE qr.question.id IN :questionIds")
    void deleteByQuestionIdIn(@org.springframework.data.repository.query.Param("questionIds") List<Long> questionIds);
}
