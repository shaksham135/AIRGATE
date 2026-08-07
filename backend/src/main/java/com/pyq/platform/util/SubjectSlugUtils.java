package com.pyq.platform.util;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.Map;
import java.util.Locale;

public class SubjectSlugUtils {

    private static final Map<String, String> NAME_TO_SLUG = new HashMap<>();
    private static final Map<String, String> SLUG_TO_NAME = new HashMap<>();

    static {
        registerMapping("dbms", "Database Management Systems", "Databases", "DBMS");
        registerMapping("os", "Operating Systems", "Operating System", "OS");
        registerMapping("cn", "Computer Networks", "Computer Network", "CN");
        registerMapping("dsa", "Data Structures and Algorithms", "Data Structures", "Algorithms", "DSA", "Data Structures & Algorithms");
        registerMapping("toc", "Theory of Computation", "Automata", "TOC");
        registerMapping("compiler", "Compiler Design", "Compilers", "CD");
        registerMapping("coa", "Computer Organization and Architecture", "Computer Organization", "COA");
        registerMapping("digital", "Digital Logic", "Digital Logic Design", "Digital Systems", "DL");
        registerMapping("discrete", "Discrete Mathematics", "Discrete Maths", "DM");
        registerMapping("em", "Engineering Mathematics", "Maths", "EM");
        registerMapping("aptitude", "General Aptitude", "Aptitude", "GA");
    }

    private static void registerMapping(String slug, String canonicalName, String... aliases) {
        SLUG_TO_NAME.put(slug.toLowerCase(Locale.ROOT), canonicalName);
        NAME_TO_SLUG.put(canonicalName.toLowerCase(Locale.ROOT), slug);
        for (String alias : aliases) {
            NAME_TO_SLUG.put(alias.toLowerCase(Locale.ROOT), slug);
        }
    }

    public static String toSlug(String subjectName) {
        if (subjectName == null || subjectName.isBlank()) return "general";
        String normalized = subjectName.trim().toLowerCase(Locale.ROOT);
        if (NAME_TO_SLUG.containsKey(normalized)) {
            return NAME_TO_SLUG.get(normalized);
        }
        // Generic slugifier fallback
        String slug = Normalizer.normalize(normalized, Normalizer.Form.NFD)
                .replaceAll("[^\\w\\s-]", "")
                .replaceAll("[\\s_-]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "general" : slug;
    }

    public static String toCanonicalSubjectName(String slug) {
        if (slug == null || slug.isBlank()) return null;
        String key = slug.trim().toLowerCase(Locale.ROOT);
        return SLUG_TO_NAME.get(key);
    }
}
