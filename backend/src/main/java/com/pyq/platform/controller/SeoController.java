package com.pyq.platform.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
public class SeoController {

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getSitemap() {
        String today = LocalDate.now().toString();
        String baseUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;

        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>daily</changefreq>\n" +
                "    <priority>1.0</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/explore</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>daily</changefreq>\n" +
                "    <priority>0.9</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/practice</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>weekly</changefreq>\n" +
                "    <priority>0.8</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/simulator</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>weekly</changefreq>\n" +
                "    <priority>0.8</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/privacy</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>monthly</changefreq>\n" +
                "    <priority>0.5</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/terms</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>monthly</changefreq>\n" +
                "    <priority>0.5</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/contact</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>monthly</changefreq>\n" +
                "    <priority>0.6</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/login</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>monthly</changefreq>\n" +
                "    <priority>0.4</priority>\n" +
                "  </url>\n" +
                "  <url>\n" +
                "    <loc>" + baseUrl + "/register</loc>\n" +
                "    <lastmod>" + today + "</lastmod>\n" +
                "    <changefreq>monthly</changefreq>\n" +
                "    <priority>0.4</priority>\n" +
                "  </url>\n" +
                "</urlset>";

        return ResponseEntity.ok(xml);
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
