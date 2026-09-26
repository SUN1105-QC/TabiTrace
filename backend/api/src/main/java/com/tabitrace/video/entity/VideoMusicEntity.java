package com.tabitrace.video.entity;

import java.math.BigDecimal;

public class VideoMusicEntity {
    public String code;
    public String name;
    /** NONE / WARM / CITY / FRESH / CINEMATIC / CHILL */
    public String category;
    public String mood;
    public BigDecimal durationSeconds;
    /** FREE / PRO */
    public String plan;
    public String recommendedTemplate;
    public Integer sortOrder;
    public Boolean enabled;
}
