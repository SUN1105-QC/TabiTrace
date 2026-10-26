package com.tabitrace.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.RECORD_COMPONENT;
import static java.lang.annotation.ElementType.TYPE_USE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/** 经度：-180 ~ 180（null 不校验，是否必填由字段自己决定） */
@Documented
@Constraint(validatedBy = {})
@DecimalMin("-180")
@DecimalMax("180")
@ReportAsSingleViolation
@Target({FIELD, PARAMETER, RECORD_COMPONENT, TYPE_USE})
@Retention(RUNTIME)
public @interface Longitude {
    String message() default "经度必须在 -180 到 180 之间";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
