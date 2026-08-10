package com.pyq.platform.service;

import com.pyq.platform.dto.TopicNode;
import com.pyq.platform.entity.Subject;
import com.pyq.platform.entity.Topic;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.SubjectRepository;
import com.pyq.platform.repository.TopicRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TopicService {

    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final QuestionRepository questionRepository;

    public TopicService(SubjectRepository subjectRepository, TopicRepository topicRepository, QuestionRepository questionRepository) {
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.questionRepository = questionRepository;
    }

    @Cacheable(value = "subjects")
    public List<Subject> getAllSubjects() {
        return subjectRepository.findAll();
    }

    @Cacheable(value = "topicTrees", key = "#subjectId")
    public List<TopicNode> getTopicTree(Long subjectId) {
        // Fetch all topics belonging to the subject to build tree in memory
        List<Topic> allTopics = topicRepository.findBySubjectId(subjectId);
        
        // Filter out root topics (where parentTopic is null)
        List<Topic> rootTopics = allTopics.stream()
                .filter(t -> t.getParentTopic() == null)
                .collect(Collectors.toList());

        // Recursively build nodes
        List<TopicNode> tree = new ArrayList<>();
        for (Topic root : rootTopics) {
            tree.add(buildNode(root, allTopics));
        }
        return tree;
    }

    private TopicNode buildNode(Topic current, List<Topic> allTopics) {
        // Find child topics of this node in the fetched list
        List<Topic> children = allTopics.stream()
                .filter(t -> t.getParentTopic() != null && t.getParentTopic().getId().equals(current.getId()))
                .collect(Collectors.toList());

        List<TopicNode> childNodes = new ArrayList<>();
        for (Topic child : children) {
            childNodes.add(buildNode(child, allTopics));
        }

        return TopicNode.builder()
                .id(current.getId())
                .name(current.getName())
                .children(childNodes)
                .build();
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public Subject createSubject(String name) {
        if (subjectRepository.existsByName(name)) {
            throw new IllegalArgumentException("Subject with name '" + name + "' already exists.");
        }
        Subject subject = Subject.builder()
                .name(name)
                .build();
        return subjectRepository.save(subject);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public Subject updateSubject(Long id, String newName) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Subject not found with ID: " + id));
        if (!subject.getName().equalsIgnoreCase(newName) && subjectRepository.existsByName(newName)) {
            throw new IllegalArgumentException("Subject with name '" + newName + "' already exists.");
        }
        subject.setName(newName);
        return subjectRepository.save(subject);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public void deleteSubject(Long subjectId, Long targetSubjectId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new IllegalArgumentException("Subject not found with ID: " + subjectId));

        if (targetSubjectId != null && !targetSubjectId.equals(subjectId)) {
            Subject targetSubject = subjectRepository.findById(targetSubjectId)
                    .orElseThrow(() -> new IllegalArgumentException("Target subject not found with ID: " + targetSubjectId));
            
            // Reassign questions to target subject
            questionRepository.reassignQuestionsToSubject(subjectId, targetSubject);

            // Reassign all topics to target subject
            List<Topic> topics = topicRepository.findBySubjectId(subjectId);
            List<Long> topicIds = topics.stream().map(Topic::getId).collect(Collectors.toList());
            if (!topicIds.isEmpty()) {
                topicRepository.updateSubjectForTopics(topicIds, targetSubject);
            }
        }

        subjectRepository.delete(subject);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public Topic createTopic(Long subjectId, String name, Long parentTopicId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new IllegalArgumentException("Subject not found with ID: " + subjectId));

        Topic parentTopic = null;
        if (parentTopicId != null) {
            parentTopic = topicRepository.findById(parentTopicId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent topic not found with ID: " + parentTopicId));
        }

        java.util.Optional<Topic> existing;
        if (parentTopic == null) {
            existing = topicRepository.findByNameAndSubjectIdAndParentTopicIsNull(name, subjectId);
        } else {
            existing = topicRepository.findByNameAndSubjectIdAndParentTopicId(name, subjectId, parentTopicId);
        }

        if (existing.isPresent()) {
            throw new IllegalArgumentException("Topic '" + name + "' already exists in this category.");
        }

        Topic topic = Topic.builder()
                .name(name)
                .subject(subject)
                .parentTopic(parentTopic)
                .build();
        return topicRepository.save(topic);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public Topic updateTopic(Long topicId, String newName) {
        Topic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new IllegalArgumentException("Topic not found with ID: " + topicId));
        topic.setName(newName.trim());
        return topicRepository.save(topic);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public Topic transferTopic(Long topicId, Long newSubjectId) {
        Topic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new IllegalArgumentException("Topic not found with ID: " + topicId));
        Subject newSubject = subjectRepository.findById(newSubjectId)
                .orElseThrow(() -> new IllegalArgumentException("Target subject not found with ID: " + newSubjectId));

        List<Long> allSubtreeTopicIds = getSubtreeTopicIds(topic);

        // Update subject for all topics in the subtree
        topicRepository.updateSubjectForTopics(allSubtreeTopicIds, newSubject);

        // Update subject_id for all questions linked to any of these subtree topic IDs
        questionRepository.updateSubjectForTopicIds(allSubtreeTopicIds, newSubject);

        // If top-level transferred topic had a parent in old subject, make it a root topic under the new subject
        if (topic.getParentTopic() != null && !topic.getParentTopic().getSubject().getId().equals(newSubjectId)) {
            topic.setParentTopic(null);
        }

        topic.setSubject(newSubject);
        return topicRepository.save(topic);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "subjects", allEntries = true),
        @CacheEvict(value = "topicTrees", allEntries = true)
    })
    public void deleteTopic(Long topicId, Long targetTopicId) {
        Topic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new IllegalArgumentException("Topic not found with ID: " + topicId));

        List<Long> subtreeTopicIds = getSubtreeTopicIds(topic);

        if (targetTopicId != null && !targetTopicId.equals(topicId)) {
            Topic targetTopic = topicRepository.findById(targetTopicId)
                    .orElseThrow(() -> new IllegalArgumentException("Target topic not found with ID: " + targetTopicId));
            
            // Reassign questions to target topic and target topic's subject
            questionRepository.reassignQuestionsToTopicAndSubject(subtreeTopicIds, targetTopic, targetTopic.getSubject());
        }

        // Unlink or delete child topics
        topicRepository.deleteAllById(subtreeTopicIds);
    }

    private List<Long> getSubtreeTopicIds(Topic rootTopic) {
        List<Long> ids = new ArrayList<>();
        ids.add(rootTopic.getId());

        List<Topic> children = topicRepository.findByParentTopicId(rootTopic.getId());
        for (Topic child : children) {
            ids.addAll(getSubtreeTopicIds(child));
        }

        return ids;
    }
}
