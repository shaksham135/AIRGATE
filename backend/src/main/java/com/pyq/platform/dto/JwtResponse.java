package com.pyq.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private Long id;
    private String username;
    private String email;
    private String role;
    private Boolean isPremium;
    private Boolean hasUsedPdfTrial;
    private java.time.LocalDateTime premiumExpiresAt;
}
