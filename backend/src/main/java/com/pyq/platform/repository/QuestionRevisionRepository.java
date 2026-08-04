package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface QuestionRevisionRepository extends JpaRepository<QuestionRevision, Long> {
    List<QuestionRevision> findByQuestionIdOrderByEditedAtDesc(Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QuestionRevision qr WHERE qr.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QuestionRevision qr WHERE qr.question.id IN :questionIds")
    void deleteByQuestionIdIn(@Param("questionIds") List<Long> questionIds);
}
