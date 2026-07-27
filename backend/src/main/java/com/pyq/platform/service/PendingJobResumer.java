package com.pyq.platform.service;

import com.pyq.platform.entity.UploadJob;
import com.pyq.platform.repository.UploadJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

@Component
@Slf4j
public class PendingJobResumer {

    private final UploadJobRepository uploadJobRepository;
    private final UploadService uploadService;
    private final TransactionTemplate transactionTemplate;

    public PendingJobResumer(UploadJobRepository uploadJobRepository,
                             UploadService uploadService,
                             org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.uploadJobRepository = uploadJobRepository;
        this.uploadService = uploadService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void resumePendingJobs() {
        log.info("Checking for pending/incomplete PDF upload jobs to resume...");
        List<UploadJob> jobs = uploadJobRepository.findAll();
        for (UploadJob job : jobs) {
            String status = job.getStatus();
            if ("PENDING".equals(status) || "PARSING".equals(status) || "CLASSIFYING".equals(status)) {
                log.info("Resuming PDF upload job {} ({}) from status {}", job.getId(), job.getFilename(), status);
                
                // Reset status to PENDING so it starts clean
                transactionTemplate.executeWithoutResult(s -> {
                    UploadJob j = uploadJobRepository.findById(job.getId()).orElseThrow();
                    j.setStatus("PENDING");
                    uploadJobRepository.save(j);
                });

                // Trigger asynchronously via proxied uploadService
                uploadService.processUploadJobAsync(job.getId(), job.getFilePath());
            }
        }
    }
}
