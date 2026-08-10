package com.pyq.platform.controller;

import com.pyq.platform.dto.TopicNode;
import com.pyq.platform.entity.Subject;
import com.pyq.platform.service.TopicService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController {

    private final TopicService topicService;

    public SubjectController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    @org.springframework.cache.annotation.Cacheable(value = "subjects")
    public ResponseEntity<List<Subject>> getAllSubjects() {
        return ResponseEntity.ok(topicService.getAllSubjects());
    }

    @GetMapping("/{id}/topics")
    @org.springframework.cache.annotation.Cacheable(value = "topics", key = "#id")
    public ResponseEntity<List<TopicNode>> getSubjectTopics(@PathVariable("id") Long id) {
        return ResponseEntity.ok(topicService.getTopicTree(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics"}, allEntries = true)
    public ResponseEntity<?> createSubject(@RequestBody java.util.Map<String, String> payload) {
        String name = payload.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse("Error: Subject name is required!"));
        }
        try {
            Subject created = topicService.createSubject(name.trim());
            return ResponseEntity.ok(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/{id}/topics")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics"}, allEntries = true)
    public ResponseEntity<?> createTopic(
            @PathVariable("id") Long subjectId,
            @RequestBody java.util.Map<String, Object> payload) {
        String name = (String) payload.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse("Error: Topic name is required!"));
        }

        Long parentTopicId = null;
        if (payload.get("parentTopicId") != null) {
            parentTopicId = Long.valueOf(payload.get("parentTopicId").toString());
        }

        try {
            com.pyq.platform.entity.Topic created = topicService.createTopic(subjectId, name.trim(), parentTopicId);
            TopicNode node = TopicNode.builder()
                    .id(created.getId())
                    .name(created.getName())
                    .children(new java.util.ArrayList<>())
                    .build();
            return ResponseEntity.ok(node);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/subjects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics", "topicTrees"}, allEntries = true)
    public ResponseEntity<?> updateSubject(
            @PathVariable("id") Long id,
            @RequestBody java.util.Map<String, String> payload) {
        String newName = payload.get("name");
        if (newName == null || newName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse("Error: Subject name is required!"));
        }
        try {
            Subject updated = topicService.updateSubject(id, newName.trim());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/admin/subjects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics", "topicTrees"}, allEntries = true)
    public ResponseEntity<?> deleteSubject(
            @PathVariable("id") Long id,
            @RequestParam(name = "targetSubjectId", required = false) Long targetSubjectId) {
        try {
            topicService.deleteSubject(id, targetSubjectId);
            return ResponseEntity.ok(new com.pyq.platform.dto.MessageResponse("Subject deleted successfully."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/topics/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics", "topicTrees"}, allEntries = true)
    public ResponseEntity<?> updateTopic(
            @PathVariable("id") Long topicId,
            @RequestBody java.util.Map<String, String> payload) {
        String newName = payload.get("name");
        if (newName == null || newName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse("Error: Topic name is required!"));
        }
        try {
            com.pyq.platform.entity.Topic updated = topicService.updateTopic(topicId, newName.trim());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }

    @PutMapping("/admin/topics/{id}/transfer")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics", "topicTrees"}, allEntries = true)
    public ResponseEntity<?> transferTopic(
            @PathVariable("id") Long topicId,
            @RequestBody java.util.Map<String, Object> payload) {
        if (payload.get("targetSubjectId") == null) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse("Error: Target subject ID is required!"));
        }
        Long targetSubjectId = Long.valueOf(payload.get("targetSubjectId").toString());
        try {
            com.pyq.platform.entity.Topic transferred = topicService.transferTopic(topicId, targetSubjectId);
            return ResponseEntity.ok(transferred);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/admin/topics/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = {"subjects", "topics", "topicTrees"}, allEntries = true)
    public ResponseEntity<?> deleteTopic(
            @PathVariable("id") Long topicId,
            @RequestParam(name = "targetTopicId", required = false) Long targetTopicId) {
        try {
            topicService.deleteTopic(topicId, targetTopicId);
            return ResponseEntity.ok(new com.pyq.platform.dto.MessageResponse("Topic deleted successfully."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new com.pyq.platform.dto.MessageResponse(e.getMessage()));
        }
    }
}
