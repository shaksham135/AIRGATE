package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.entity.UploadJob;
import com.pyq.platform.entity.User;
import com.pyq.platform.entity.Question;
import com.pyq.platform.repository.UploadJobRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.security.UserDetailsImpl;
import com.pyq.platform.service.UploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final UploadService uploadService;
    private final UploadJobRepository uploadJobRepository;
    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;

    public UploadController(UploadService uploadService, UploadJobRepository uploadJobRepository,
            UserRepository userRepository, QuestionRepository questionRepository) {
        this.uploadService = uploadService;
        this.uploadJobRepository = uploadJobRepository;
        this.userRepository = userRepository;
        this.questionRepository = questionRepository;
    }


    // Upload PDF
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> uploadPDF(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: File is empty!"));
        }

        if (!file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Only PDF documents are supported!"));
        }

        try {
            User user = userRepository.findById(userDetails.getId()).orElseThrow();
            UploadJob job = uploadService.createUploadJob(file, user);

            // Execute parsing asynchronously in the background
            uploadService.processUploadJobAsync(job.getId(), job.getFilePath());

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(job);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error uploading PDF: " + e.getMessage()));
        }
    }

    // List Jobs
    @GetMapping("/jobs")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<List<UploadJob>> getUploadJobs(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<UploadJob> jobs = uploadJobRepository.findAllByOrderByCreatedAtDesc();
        return ResponseEntity.ok(jobs);
    }

    // Get Job Status
    @GetMapping("/jobs/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> getJobStatus(@PathVariable("id") Long id) {
        Optional<UploadJob> jobOpt = uploadJobRepository.findById(id);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Job not found with ID: " + id));
        }
        return ResponseEntity.ok(jobOpt.get());
    }

    // Delete Upload Job and associated questions
    @DeleteMapping("/jobs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> deleteJob(@PathVariable("id") Long id) {
        Optional<UploadJob> jobOpt = uploadJobRepository.findById(id);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Job not found with ID: " + id));
        }

        UploadJob job = jobOpt.get();
        // Find questions by pdfSourceName (which is the job filename)
        List<Question> questions = questionRepository.findByPdfSourceName(job.getFilename());
        for (Question question : questions) {
            // Delete question, triggers cascade delete of options, solves, comments, bookmarks, answers, etc.
            questionRepository.delete(question);
        }

        // Delete the job itself
        uploadJobRepository.delete(job);

        return ResponseEntity.ok(new MessageResponse("Upload job '" + job.getFilename() + "' and all " + questions.size() + " parsed questions deleted successfully!"));
    }

    // Pause Job
    @PostMapping("/jobs/{id}/pause")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> pauseJob(@PathVariable("id") Long id) {
        Optional<UploadJob> jobOpt = uploadJobRepository.findById(id);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Job not found with ID: " + id));
        }
        UploadJob job = jobOpt.get();
        if (!"PARSING".equalsIgnoreCase(job.getStatus()) && !"CLASSIFYING".equalsIgnoreCase(job.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Only active jobs can be paused. Current status: " + job.getStatus()));
        }
        job.setStatus("PAUSED");
        uploadJobRepository.save(job);
        return ResponseEntity.ok(new MessageResponse("PDF ingestion job '" + job.getFilename() + "' paused successfully!"));
    }

    // Resume Job
    @PostMapping("/jobs/{id}/resume")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> resumeJob(@PathVariable("id") Long id) {
        Optional<UploadJob> jobOpt = uploadJobRepository.findById(id);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Job not found with ID: " + id));
        }
        UploadJob job = jobOpt.get();
        if (!"PAUSED".equalsIgnoreCase(job.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Only paused jobs can be resumed. Current status: " + job.getStatus()));
        }
        job.setStatus("CLASSIFYING");
        uploadJobRepository.save(job);
        return ResponseEntity.ok(new MessageResponse("PDF ingestion job '" + job.getFilename() + "' resumed successfully!"));
    }
}

