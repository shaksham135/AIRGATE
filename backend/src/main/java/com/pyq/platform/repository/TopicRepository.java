package com.pyq.platform.repository;

import com.pyq.platform.entity.Topic;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface TopicRepository extends JpaRepository<Topic, Long> {

    @EntityGraph(attributePaths = {"subject", "parentTopic"})
    List<Topic> findBySubjectId(Long subjectId);

    @EntityGraph(attributePaths = {"subject", "parentTopic"})
    List<Topic> findBySubjectIdAndParentTopicIsNull(Long subjectId);

    List<Topic> findByParentTopicId(Long parentTopicId);
    List<Topic> findByName(String name);
    Optional<Topic> findByNameAndSubjectIdAndParentTopicId(String name, Long subjectId, Long parentTopicId);
    Optional<Topic> findByNameAndSubjectIdAndParentTopicIsNull(String name, Long subjectId);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE Topic t SET t.parentTopic = :newParent WHERE t.parentTopic.id = :oldParentId")
    int relinkChildTopics(@Param("oldParentId") Long oldParentId, @Param("newParent") Topic newParent);
}
