package com.pyq.platform.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class PDFParserService {

    private final CloudinaryService cloudinaryService;

    public PDFParserService(CloudinaryService cloudinaryService) {
        this.cloudinaryService = cloudinaryService;
    }

    public static class RawQuestionBlock {
        public String rawText;
        public int pageNumber;
        public String imagePath; // Path to extracted image, if any
    }

    public List<RawQuestionBlock> parsePDF(String pdfPath, Long jobId) throws IOException {
        List<RawQuestionBlock> blocks = new ArrayList<>();
        File pdfFile = new File(pdfPath);
        if (!pdfFile.exists()) {
            throw new IOException("PDF file not found at path: " + pdfPath);
        }

        Map<String, Integer> imageHashCounts = new HashMap<>();
        Map<String, String> imageHashToPath = new HashMap<>();
        Map<Integer, List<String>> pageToImageHashes = new HashMap<>();

        try (PDDocument document = PDDocument.load(pdfFile)) {
            PDFTextStripper stripper = new PDFTextStripper();
            int totalPages = document.getNumberOfPages();

            // Pass 1: Scan all pages for images and build hash frequencies
            log.info("Pass 1: Scanning PDF for images and calculating checksums...");
            for (int pageNum = 1; pageNum <= totalPages; pageNum++) {
                PDPage page = document.getPage(pageNum - 1);
                PDResources resources = page.getResources();
                if (resources == null) continue;

                int imgIndex = 1;
                for (COSName name : resources.getXObjectNames()) {
                    if (resources.isImageXObject(name)) {
                        try {
                            PDImageXObject image = (PDImageXObject) resources.getXObject(name);
                            BufferedImage bufferedImage = image.getImage();
                            if (bufferedImage == null || bufferedImage.getWidth() < 100 || bufferedImage.getHeight() < 100) {
                                continue;
                            }

                            // Get image bytes to compute checksum
                            ByteArrayOutputStream baos = new ByteArrayOutputStream();
                            ImageIO.write(bufferedImage, "PNG", baos);
                            byte[] imgBytes = baos.toByteArray();
                            String hash = calculateMD5(imgBytes);

                            // Update count
                            imageHashCounts.put(hash, imageHashCounts.getOrDefault(hash, 0) + 1);

                            // Map page to list of hashes on this page
                            pageToImageHashes.computeIfAbsent(pageNum, k -> new ArrayList<>()).add(hash);

                            // Save image to disk if we haven't seen it yet
                            if (!imageHashToPath.containsKey(hash)) {
                                String imgName = String.format("q_job_%d_p_%d_idx_%d_%s.png",
                                        jobId, pageNum, imgIndex, UUID.randomUUID().toString().substring(0, 8));
                                String destinationPath = "uploads/images/" + imgName;
                                File outFile = new File(destinationPath).getAbsoluteFile();
                                outFile.getParentFile().mkdirs();

                                ImageIO.write(bufferedImage, "PNG", outFile);
                                
                                String cloudinaryUrl = null;
                                if (cloudinaryService.isConfigured()) {
                                    cloudinaryUrl = cloudinaryService.uploadFile(outFile, "images");
                                }

                                if (cloudinaryUrl != null) {
                                    imageHashToPath.put(hash, cloudinaryUrl);
                                    try {
                                        outFile.delete(); // delete local copy to save space
                                    } catch (Exception de) {
                                        log.warn("Failed to delete local temp image: {}", de.getMessage());
                                    }
                                } else {
                                    imageHashToPath.put(hash, "/uploads/images/" + imgName);
                                }
                            }
                        } catch (Exception e) {
                            log.warn("Image scanning skipped for page {}: {}", pageNum, e.getMessage());
                        }
                        imgIndex++;
                    }
                }
            }

            // Pass 2: Loop through pages to parse text and map non-watermark images
            log.info("Pass 2: Segmenting text and mapping unique diagrams...");
            for (int pageNum = 1; pageNum <= totalPages; pageNum++) {
                // Extract Text for the page
                stripper.setStartPage(pageNum);
                stripper.setEndPage(pageNum);
                String pageText = stripper.getText(document);

                // Map the extracted image if it exists and is NOT a watermark/logo
                String extractedImagePath = null;
                List<String> pageHashes = pageToImageHashes.get(pageNum);
                if (pageHashes != null) {
                    for (String hash : pageHashes) {
                        int occurrenceCount = imageHashCounts.getOrDefault(hash, 0);
                        // Filter out watermarks/logos (repeated on > 2 pages)
                        if (occurrenceCount <= 2) {
                            extractedImagePath = imageHashToPath.get(hash);
                            break; // Stop at the first real diagram found on the page
                        } else {
                            log.info("Filtered out repeated image/watermark with hash: {} (occurrences: {}) on page {}", hash, occurrenceCount, pageNum);
                        }
                    }
                }

                // Segment page text into individual question blocks
                List<String> segments = segmentPageText(pageText);
                for (String segment : segments) {
                    if (segment.trim().length() < 30) continue; // skip noise/footers

                    RawQuestionBlock block = new RawQuestionBlock();
                    block.rawText = segment.trim();
                    block.pageNumber = pageNum;
                    block.imagePath = extractedImagePath;

                    blocks.add(block);
                }
            }
        }
        return blocks;
    }

    private String calculateMD5(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] array = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : array) {
                sb.append(Integer.toHexString((b & 0xFF) | 0x100).substring(1, 3));
            }
            return sb.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }

    private boolean isInstructionLine(String line) {
        String lower = line.trim().toLowerCase();
        boolean hasInstructionKeywords = lower.contains("carry") && (lower.contains("mark") || lower.contains("each"));
        if (!hasInstructionKeywords) {
            return false;
        }
        boolean mentionsQuestions = lower.contains("question") || lower.matches(".*\\bq\\.?\\s*\\d+.*");
        return mentionsQuestions;
    }

    private boolean isPassageHeaderLine(String line) {
        String lower = line.trim().toLowerCase();
        return lower.startsWith("common data") ||
               lower.startsWith("statement for linked") ||
               lower.startsWith("linked answer questions") ||
               lower.startsWith("passage for questions") ||
               lower.matches("^\\s*read the following\\s+.*") ||
               lower.matches("^\\s*consider the following\\s+.*");
    }

    private List<String> segmentPageText(String pageText) {
        List<String> segments = new ArrayList<>();
        String[] lines = pageText.split("\\r?\\n");
        
        StringBuilder currentBlock = new StringBuilder();
        Pattern boundaryPattern = Pattern.compile("^(?:Q\\.?\\s*\\d+)\\b.*", Pattern.CASE_INSENSITIVE);
        
        String pagePreamble = "";

        for (String line : lines) {
            String trimmedLine = line.trim();
            
            if (isInstructionLine(trimmedLine)) {
                log.info("Skipped instruction line: {}", trimmedLine);
                continue;
            }
            
            boolean isBoundary = false;
            if (boundaryPattern.matcher(trimmedLine).matches()) {
                isBoundary = true;
            } else if (isPassageHeaderLine(trimmedLine)) {
                isBoundary = true;
            }

            if (isBoundary) {
                if (currentBlock.length() > 0) {
                    String blockStr = currentBlock.toString().trim();
                    if (startsWithQuestionMarker(blockStr)) {
                        if (!pagePreamble.isEmpty()) {
                            blockStr = pagePreamble + "\n\n" + blockStr;
                        }
                        segments.add(blockStr);
                    } else {
                        if (isPassageBlock(blockStr)) {
                            pagePreamble = blockStr;
                        }
                    }
                    currentBlock = new StringBuilder();
                }
            }
            currentBlock.append(line).append("\n");
        }
        
        if (currentBlock.length() > 0) {
            String blockStr = currentBlock.toString().trim();
            if (startsWithQuestionMarker(blockStr)) {
                if (!pagePreamble.isEmpty()) {
                    blockStr = pagePreamble + "\n\n" + blockStr;
                }
                segments.add(blockStr);
            }
        }
        
        return segments;
    }

    private boolean isPassageBlock(String text) {
        if (text == null || text.length() < 30) return false;
        String lower = text.toLowerCase();
        return lower.contains("common data") || 
               lower.contains("statement for") || 
               lower.contains("linked answer") || 
               lower.contains("passage") || 
               lower.contains("consider the following") || 
               lower.contains("read the following");
    }

    private boolean startsWithQuestionMarker(String text) {
        if (text == null || text.isEmpty()) return false;
        Pattern startPattern = Pattern.compile("^Q\\.?\\s*\\d+.*", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        return startPattern.matcher(text).matches();
    }
}
