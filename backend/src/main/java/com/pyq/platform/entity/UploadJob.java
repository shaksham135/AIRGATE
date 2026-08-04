package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "upload_jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UploadJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String filename;

    @Column(nullable = false, length = 20)
    private String status; // PENDING, PARSING, CLASSIFYING, COMPLETED, FAILED

    @Column(name = "error_message", length = 255)
    private String errorMessage;

    @Builder.Default
    @Column(name = "total_questions_found")
    private Integer totalQuestionsFound = 0;

    @Builder.Default
    @Column(name = "processed_questions")
    private Integer processedQuestions = 0;

    @Builder.Default
    @Column(name = "duplicate_questions")
    private Integer duplicateQuestions = 0;

    @Builder.Default
    @Column(name = "failed_questions")
    private Integer failedQuestions = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "processing_time_ms")
    private Long processingTimeMs;

    @Column(name = "file_path", length = 255)
    private String filePath;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.totalQuestionsFound == null) this.totalQuestionsFound = 0;
        if (this.processedQuestions == null) this.processedQuestions = 0;
        if (this.duplicateQuestions == null) this.duplicateQuestions = 0;
        if (this.failedQuestions == null) this.failedQuestions = 0;
    }
}
