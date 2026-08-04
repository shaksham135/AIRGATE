package com.pyq.platform.controller;

import com.pyq.platform.repository.QuestionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
public class SeoController {

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    private final QuestionRepository questionRepository;

    public SeoController(QuestionRepository questionRepository) {
        this.questionRepository = questionRepository;
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    @org.springframework.cache.annotation.Cacheable(value = "publicMeta", key = "'sitemap'")
    public ResponseEntity<String> getSitemap() {
        String today = LocalDate.now().toString();
        String baseUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        String[][] staticRoutes = {
            {"/", "1.0", "daily"},
            {"/explore", "0.9", "daily"},
            {"/practice", "0.8", "weekly"},
            {"/simulator", "0.8", "weekly"},
            {"/privacy", "0.5", "monthly"},
            {"/terms", "0.5", "monthly"},
            {"/contact", "0.6", "monthly"},
            {"/login", "0.4", "monthly"},
            {"/register", "0.4", "monthly"}
        };

        for (String[] r : staticRoutes) {
            sb.append("  <url>\n");
            sb.append("    <loc>").append(baseUrl).append(r[0]).append("</loc>\n");
            sb.append("    <lastmod>").append(today).append("</lastmod>\n");
            sb.append("    <changefreq>").append(r[2]).append("</changefreq>\n");
            sb.append("    <priority>").append(r[1]).append("</priority>\n");
            sb.append("  </url>\n");
        }

        // Dynamically add all approved question pages to sitemap for 100% Google indexing
        try {
            List<Long> qIds = questionRepository.findApprovedQuestionIds();
            for (Long qId : qIds) {
                sb.append("  <url>\n");
                sb.append("    <loc>").append(baseUrl).append("/question/").append(qId).append("</loc>\n");
                sb.append("    <lastmod>").append(today).append("</lastmod>\n");
                sb.append("    <changefreq>weekly</changefreq>\n");
                sb.append("    <priority>0.8</priority>\n");
                sb.append("  </url>\n");
            }
        } catch (Exception ignored) {}

        sb.append("</urlset>");

        return ResponseEntity.ok(sb.toString());
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getRobotsTxt() {
        String baseUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;

        String robots = "# AIRGATE Platform Robots.txt for Googlebot & Search Crawlers\n" +
                "User-agent: *\n" +
                "Allow: /\n" +
                "Allow: /explore\n" +
                "Allow: /practice\n" +
                "Allow: /simulator\n" +
                "Allow: /privacy\n" +
                "Allow: /terms\n" +
                "Allow: /contact\n" +
                "Allow: /login\n" +
                "Allow: /register\n" +
                "Disallow: /admin/\n" +
                "Disallow: /api/admin/\n" +
                "\n" +
                "Sitemap: " + baseUrl + "/sitemap.xml\n";

        return ResponseEntity.ok(robots);
    }
}
