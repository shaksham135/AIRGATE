package com.pyq.platform.controller;

import com.pyq.platform.entity.Question;
import com.pyq.platform.repository.QuestionRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping
public class SitemapController {

    private final QuestionRepository questionRepository;

    public SitemapController(QuestionRepository questionRepository) {
        this.questionRepository = questionRepository;
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getSitemap() {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // 1. Static High Priority Pages
        xml.append("  <url>\n");
        xml.append("    <loc>https://airgate.in/</loc>\n");
        xml.append("    <changefreq>daily</changefreq>\n");
        xml.append("    <priority>1.0</priority>\n");
        xml.append("  </url>\n");

        xml.append("  <url>\n");
        xml.append("    <loc>https://airgate.in/explore</loc>\n");
        xml.append("    <changefreq>daily</changefreq>\n");
        xml.append("    <priority>0.9</priority>\n");
        xml.append("  </url>\n");

        xml.append("  <url>\n");
        xml.append("    <loc>https://airgate.in/premium</loc>\n");
        xml.append("    <changefreq>weekly</changefreq>\n");
        xml.append("    <priority>0.8</priority>\n");
        xml.append("  </url>\n");

        // 2. Dynamic Question Detail Pages (Guarantees 100% verification for every single question)
        List<Question> questions = questionRepository.findAll();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        for (Question q : questions) {
            xml.append("  <url>\n");
            xml.append("    <loc>https://airgate.in/questions/").append(q.getId()).append("</loc>\n");
            java.time.LocalDateTime lastModTime = q.getVerifiedAt() != null ? q.getVerifiedAt() : q.getCreatedAt();
            if (lastModTime != null) {
                xml.append("    <lastmod>").append(lastModTime.format(formatter)).append("</lastmod>\n");
            }
            xml.append("    <changefreq>monthly</changefreq>\n");
            xml.append("    <priority>0.7</priority>\n");
            xml.append("  </url>\n");
        }

        xml.append("</urlset>");
        return ResponseEntity.ok(xml.toString());
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getRobotsTxt() {
        String robots = """
                User-agent: *
                Allow: /
                Allow: /explore
                Allow: /questions/
                Allow: /login
                Allow: /register
                Allow: /premium

                Disallow: /admin
                Disallow: /upload
                Disallow: /review
                Disallow: /users
                Disallow: /profile

                Sitemap: https://airgate.in/sitemap.xml
                """;
        return ResponseEntity.ok(robots);
    }
}
