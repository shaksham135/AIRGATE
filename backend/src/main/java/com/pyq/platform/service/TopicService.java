package com.pyq.platform.service;

import com.pyq.platform.dto.TopicNode;
import com.pyq.platform.entity.Subject;
import com.pyq.platform.entity.Topic;
import com.pyq.platform.repository.SubjectRepository;
import com.pyq.platform.repository.TopicRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TopicService {

    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;

    public TopicService(SubjectRepository subjectRepository, TopicRepository topicRepository) {
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
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
    @CacheEvict(value = "subjects", allEntries = true)
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
    @CacheEvict(value = "topicTrees", allEntries = true)
    public Topic createTopic(Long subjectId, String name, Long parentTopicId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new IllegalArgumentException("Subject not found with ID: " + subjectId));

        Topic parentTopic = null;
        if (parentTopicId != null) {
            parentTopic = topicRepository.findById(parentTopicId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent topic not found with ID: " + parentTopicId));
        }

        // Check uniqueness under same subject and parent topic
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
}
