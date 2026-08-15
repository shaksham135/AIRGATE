package com.pyq.platform.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;
import java.util.Set;

@Data
public class CreateQuestionRequest {

    @NotBlank(message = "Question text is required")
    @Size(min = 10, max = 10000, message = "Question text must be between 10 and 10000 characters")
    private String text;

    @NotBlank(message = "Question type is required")
    @Pattern(regexp = "MCQ|MSQ|NAT", message = "Question type must be MCQ, MSQ, or NAT")
    private String questionType;

    @NotNull(message = "Marks is required")
    @Min(value = 1, message = "Marks must be at least 1")
    @Max(value = 10, message = "Marks must not exceed 10")
    private Integer marks;

    @NotNull(message = "Negative marks is required")
    @DecimalMin(value = "-2.0", message = "Negative marks magnitude must not exceed 2.0")
    @DecimalMax(value = "2.0", message = "Negative marks magnitude must not exceed 2.0")
    private Double negativeMarks;

    private Integer year = 2026;

    private Integer questionNumber;

    @NotNull(message = "Subject ID is required")
    @Positive(message = "Subject ID must be positive")
    private Long subjectId;

    @NotNull(message = "Topic ID is required")
    @Positive(message = "Topic ID must be positive")
    private Long topicId;

    @Size(max = 255, message = "PDF source name must not exceed 255 characters")
    private String pdfSourceName = "Manual Entry";

    @Size(max = 500, message = "PDF source path must not exceed 500 characters")
    private String pdfSourcePath = "Manual Entry";

    @Min(value = 1, message = "PDF page number must be at least 1")
    private Integer pdfPageNumber = 1;

    @Size(max = 500, message = "Image path must not exceed 500 characters")
    private String imagePath;

    @Pattern(regexp = "PENDING|APPROVED|PUBLISHED|ARCHIVED", message = "Status must be PENDING, APPROVED, PUBLISHED, or ARCHIVED")
    private String status = "PENDING";

    @Size(max = 10, message = "Options must not exceed 10 items")
    private List<String> options;

    @Size(max = 10, message = "Tags must not exceed 10 items")
    private Set<String> tags;

    private String aiSuggestedAnswer;
    private String aiSuggestedExplanation;
}
