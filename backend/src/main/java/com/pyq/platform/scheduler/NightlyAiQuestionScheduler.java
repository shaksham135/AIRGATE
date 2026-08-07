package com.pyq.platform.scheduler;

import com.pyq.platform.entity.SystemSettings;
import com.pyq.platform.repository.SystemSettingsRepository;
import com.pyq.platform.service.AiQuestionGeneratorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@EnableScheduling
@Slf4j
public class NightlyAiQuestionScheduler {

    private final AiQuestionGeneratorService generatorService;
    private final SystemSettingsRepository settingsRepository;

    private boolean isBatchRunning = false;

    public NightlyAiQuestionScheduler(
            AiQuestionGeneratorService generatorService,
            SystemSettingsRepository settingsRepository) {
        this.generatorService = generatorService;
        this.settingsRepository = settingsRepository;
    }

    /**
     * Cron runs at 00:00 AM (12:00 AM midnight) IST every night
     */
    @Scheduled(cron = "0 0 0 * * ?", zone = "Asia/Kolkata")
    public void startNightlyBatch() {
        log.info("⏰ 12:00 AM IST Trigger: Initiating Nightly Automated AI Question Generator Batch...");
        runBatchLoop(false);
    }

    /**
     * Executes the batch loop (e.g., 00:00 AM - 02:00 AM IST)
     */
    public void runBatchLoop(boolean isManualTest) {
        if (isBatchRunning) {
            log.warn("Nightly AI batch is already running. Skipping trigger.");
            return;
        }

        isBatchRunning = true;
        int maxAttempts = isManualTest ? 5 : 1440; // 5 sample questions for manual test, 1440 max for window
        int attemptCount = 0;
        int acceptedCount = 0;

        try {
            while (isBatchRunning && attemptCount < maxAttempts) {
                // Check if admin disabled the generator in SystemSettings
                SystemSettings settings = settingsRepository.findById(1).orElse(null);
                if (settings != null && Boolean.FALSE.equals(settings.getAiGeneratorEnabled())) {
                    log.info("⏸️ Nightly AI Generator has been paused by Administrator via Admin Control Panel.");
                    break;
                }

                // Check time window in Indian Standard Time (IST - Asia/Kolkata)
                if (!isManualTest) {
                    int currentHour = LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata")).getHour();
                    int startHour = (settings != null && settings.getAiGeneratorStartHour() != null) ? settings.getAiGeneratorStartHour() : 0;
                    int endHour = (settings != null && settings.getAiGeneratorEndHour() != null) ? settings.getAiGeneratorEndHour() : 4;

                    if (currentHour < startHour || currentHour >= endHour) {
                        log.info("⌛ Time window expired (Current IST hour: {}, Start: {}, End: {}). Stopping Nightly AI Generator Batch.", currentHour, startHour, endHour);
                        break;
                    }
                }

                attemptCount++;
                try {
                    boolean success = generatorService.generateAndVerifySingleQuestion();
                    if (success) {
                        acceptedCount++;
                    }
                } catch (Exception e) {
                    log.error("⚠️ Exception during nightly AI question generation attempt #{}: {}", attemptCount, e.getMessage(), e);
                }

                // Pacing delay (35 seconds between calls staying safely within 6,000 TPM across multi-keys)
                try {
                    Thread.sleep(35000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        } finally {
            isBatchRunning = false;
            log.info("🏁 Nightly AI Question Generator Batch Completed. Attempts: {}, Verified Accepted: {}", attemptCount, acceptedCount);
        }
    }

    public boolean isBatchRunning() {
        return isBatchRunning;
    }
}
