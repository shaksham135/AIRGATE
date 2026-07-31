package com.pyq.platform.controller;

import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.TopicRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@Transactional(readOnly = true)
public class AnalyticsController {

    private final QuestionRepository questionRepository;
    private final TopicRepository topicRepository;
    private final com.pyq.platform.repository.EmailLogRepository emailLogRepository;
    private final com.pyq.platform.service.QuestionService questionService;

    public AnalyticsController(QuestionRepository questionRepository, 
                               TopicRepository topicRepository,
                               com.pyq.platform.repository.EmailLogRepository emailLogRepository,
                               com.pyq.platform.service.QuestionService questionService) {
        this.questionRepository = questionRepository;
        this.topicRepository = topicRepository;
        this.emailLogRepository = emailLogRepository;
        this.questionService = questionService;
    }

    @PostMapping("/analytics/pdf-download")
    @Transactional
    public ResponseEntity<?> trackPdfDownload(@RequestBody(required = false) Map<String, String> body) {
        String userEmail = (body != null && body.containsKey("email")) ? body.get("email") : "aspirant@airgate.in";
        EmailLog log = EmailLog.builder()
                .recipientEmail(userEmail)
                .subject("Revision PDF Compilation Downloaded")
                .emailType("PDF_COMPILATION")
                .status("SENT")
                .sentAt(java.time.LocalDateTime.now())
                .build();
        emailLogRepository.save(log);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // Dynamic yearly frequency count for a topic
    @GetMapping("/analytics/topics/{topicId}/frequency")
    public ResponseEntity<?> getTopicFrequency(@PathVariable("topicId") Long topicId) {
        Optional<Topic> topicOpt = topicRepository.findById(topicId);
        if (topicOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new com.pyq.platform.dto.MessageResponse("Error: Topic not found!"));
        }

        // Collect all subtopic IDs recursively to include in stats
        List<Long> topicIds = getSubtopicIdsRecursive(topicId);
        
        // Fetch questions under these topic IDs via indexed query
        List<Question> questions = questionRepository.findByTopicIdInAndStatus(topicIds, "APPROVED");

        // Group by year and count
        Map<Integer, Long> yearlyCounts = questions.stream()
                .collect(Collectors.groupingBy(Question::getYear, Collectors.counting()));

        // Convert to sorted list of maps
        List<Map<String, Object>> result = new ArrayList<>();
        yearlyCounts.keySet().stream().sorted().forEach(year -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("year", year);
            entry.put("count", yearlyCounts.get(year));
            result.add(entry);
        });

        return ResponseEntity.ok(result);
    }

    // Related questions listing based on same topic (Cached for sub-5ms response)
    @GetMapping("/questions/{id}/similar")
    @org.springframework.cache.annotation.Cacheable(value = "similarQuestions", key = "#id")
    public ResponseEntity<?> getSimilarQuestions(@PathVariable("id") Long id) {
        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new com.pyq.platform.dto.MessageResponse("Error: Question not found!"));
        }

        Question source = questionOpt.get();
        Set<String> sourceTagNames = source.getTags().stream().map(Tag::getName).collect(Collectors.toSet());

        // Find matches via indexed topic query
        List<Question> similar = questionRepository.findTop5ByTopicIdAndStatusAndIdNot(
                source.getTopic().getId(), "APPROVED", source.getId());

        List<QuestionDTO> dtos = similar.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    private List<Long> getSubtopicIdsRecursive(Long topicId) {
        return questionService.getSubtopicIdsRecursive(topicId);
    }

    private QuestionDTO convertToDTO(Question question) {
        return QuestionDTO.builder()
                .id(question.getId())
                .text(question.getText())
                .questionType(question.getQuestionType())
                .marks(question.getMarks())
                .negativeMarks(question.getNegativeMarks())
                .year(question.getYear())
                .subjectId(question.getSubject().getId())
                .subjectName(question.getSubject().getName())
                .topicId(question.getTopic().getId())
                .topicName(question.getTopic().getName())
                .isCommunityVerified(question.getIsCommunityVerified())
                .pdfSourceName(question.getPdfSourceName())
                .pdfSourcePath(question.getPdfSourcePath())
                .pdfPageNumber(question.getPdfPageNumber())
                .imagePath(question.getImagePath())
                .status(question.getStatus())
                .build();
    }
}
