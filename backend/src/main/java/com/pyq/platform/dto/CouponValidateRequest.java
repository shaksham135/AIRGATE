package com.pyq.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CouponValidateRequest {
    private String code;
    private String planTier; // MONTHLY, QUARTERLY, SEASON, ANNUAL
    private BigDecimal originalPrice;
}
