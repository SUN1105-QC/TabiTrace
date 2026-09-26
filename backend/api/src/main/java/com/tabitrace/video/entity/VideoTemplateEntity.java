package com.tabitrace.video.entity;

import java.math.BigDecimal;

public class VideoTemplateEntity {
    public String code;
    public String name;
    public String englishName;
    public String description;
    public String suitableFor;
    /** SLOW / MEDIUM / FAST */
    public String pace;
    /** ffmpeg xfade 转场名称 */
    public String transition;
    public BigDecimal transitionSeconds;
    /** FREE / PRO */
    public String plan;
    public String recommendedMusic;
    public Integer sortOrder;
    public Boolean enabled;
}
