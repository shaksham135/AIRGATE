package com.pyq.platform.repository;

import com.pyq.platform.entity.MockAttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public interface MockAttemptAnswerRepository extends JpaRepository<MockAttemptAnswer, Long> {

    @Modifying
    @Transactional
    @Query("DELETE FROM MockAttemptAnswer maa WHERE maa.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM MockAttemptAnswer maa WHERE maa.question.id IN :questionIds")
    void deleteByQuestionIdIn(@Param("questionIds") List<Long> questionIds);
}
