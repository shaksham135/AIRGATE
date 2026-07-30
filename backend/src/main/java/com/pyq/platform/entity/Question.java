package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "questions", indexes = {
    @Index(name = "idx_q_status", columnList = "status"),
    @Index(name = "idx_q_subject_status", columnList = "subject_id, status"),
    @Index(name = "idx_q_topic_status", columnList = "topic_id, status"),
    @Index(name = "idx_q_year_status", columnList = "year, status"),
    @Index(name = "idx_q_checksum", columnList = "checksum_hash"),
    @Index(name = "idx_q_pdf_source", columnList = "pdf_source_name")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"options", "tags"})
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(name = "question_type", nullable = false, length = 10)
    private String questionType; // MCQ, MSQ, NAT

    @Column(nullable = false, length = 20)
    private String difficulty = "MEDIUM"; // EASY, MEDIUM, HARD, GATE_SUPER

    @Column(nullable = false)
    private Integer marks;

    @Column(name = "negative_marks", nullable = false)
    private Double negativeMarks;

    @Column(nullable = false)
    private Integer year;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id", nullable = false)
    private Topic topic;

    @Column(name = "is_community_verified", nullable = false)
    private Boolean isCommunityVerified = false;

    @Column(name = "checksum_hash", nullable = false, unique = true, length = 64)
    private String checksumHash;

    @Column(name = "pdf_source_name", nullable = false, length = 100)
    private String pdfSourceName;

    @Column(name = "pdf_source_path", nullable = false, length = 255)
    private String pdfSourcePath;

    @Column(name = "pdf_page_number", nullable = false)
    private Integer pdfPageNumber;

    @Column(name = "image_path", length = 255)
    private String imagePath; // Path to extracted diagram image on local filesystem

    @Column(nullable = false, length = 20)
    private String status; // UPLOADED, PARSED, AI_PROCESSED, AI_FAILED, PENDING_REVIEW, APPROVED, PUBLISHED, ARCHIVED

    @Version
    private Integer version;

    @Column(name = "publish_at")
    private LocalDateTime publishAt;

    @Column(name = "raw_ocr_text", columnDefinition = "TEXT")
    private String rawOcrText;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by")
    private User verifiedBy;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @org.hibernate.annotations.Fetch(org.hibernate.annotations.FetchMode.SUBSELECT)
    @Builder.Default
    private List<QuestionOption> options = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @org.hibernate.annotations.Fetch(org.hibernate.annotations.FetchMode.SUBSELECT)
    @Builder.Default
    private List<QuestionAIAnalysis> aiAnalyses = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<QuestionRevision> revisions = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<Bookmark> bookmarks = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<DiscussionComment> discussionComments = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<UserAnswer> userAnswers = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<UserQuestionSolve> userQuestionSolves = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<ExplanationVote> explanationVotes = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @Builder.Default
    private List<QuestionReport> reports = new ArrayList<>();


    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "question_tags",
        joinColumns = @JoinColumn(name = "question_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.isCommunityVerified == null) {
            this.isCommunityVerified = false;
        }
    }
}
