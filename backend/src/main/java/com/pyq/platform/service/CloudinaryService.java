package com.pyq.platform.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.Map;

@Service
@Slf4j
public class CloudinaryService {

    @Value("${cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${cloudinary.api-key:}")
    private String apiKey;

    @Value("${cloudinary.api-secret:}")
    private String apiSecret;

    private Cloudinary cloudinary;
    private boolean isConfigured = false;

    @PostConstruct
    public void init() {
        if (cloudName != null && !cloudName.trim().isEmpty() &&
            apiKey != null && !apiKey.trim().isEmpty() &&
            apiSecret != null && !apiSecret.trim().isEmpty()) {
            try {
                this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName.trim(),
                    "api_key", apiKey.trim(),
                    "api_secret", apiSecret.trim()
                ));
                this.isConfigured = true;
                log.info("Cloudinary successfully configured for cloud: {}", cloudName);
            } catch (Exception e) {
                log.error("Failed to initialize Cloudinary client: {}", e.getMessage());
            }
        } else {
            log.info("Cloudinary is not configured or credentials missing. Falling back to local storage.");
        }
    }

    public boolean isConfigured() {
        return isConfigured;
    }

    /**
     * Uploads a local file to Cloudinary.
     * @param file local File object
     * @param folder folder name in Cloudinary
     * @return secure URL of uploaded file, or null on failure
     */
    public String uploadFile(File file, String folder) {
        if (!isConfigured) return null;
        try {
            Map<?, ?> options = ObjectUtils.asMap(
                "folder", folder,
                "resource_type", "auto"
            );
            Map<?, ?> uploadResult = cloudinary.uploader().upload(file, options);
            return (String) uploadResult.get("secure_url");
        } catch (IOException e) {
            log.error("Cloudinary file upload failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Uploads a MultipartFile to Cloudinary.
     * @param multipartFile spring MultipartFile
     * @param folder folder name in Cloudinary
     * @return secure URL of uploaded file, or null on failure
     */
    public String uploadMultipartFile(MultipartFile multipartFile, String folder) {
        if (!isConfigured) return null;
        try {
            Map<?, ?> options = ObjectUtils.asMap(
                "folder", folder,
                "resource_type", "auto"
            );
            Map<?, ?> uploadResult = cloudinary.uploader().upload(multipartFile.getBytes(), options);
            return (String) uploadResult.get("secure_url");
        } catch (IOException e) {
            log.error("Cloudinary multipart upload failed: {}", e.getMessage());
            return null;
        }
    }
}
