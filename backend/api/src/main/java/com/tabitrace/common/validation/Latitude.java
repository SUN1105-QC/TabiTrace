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

/** 纬度：-90 ~ 90（null 不校验，是否必填由字段自己决定） */
@Documented
@Constraint(validatedBy = {})
@DecimalMin("-90")
@DecimalMax("90")
@ReportAsSingleViolation
@Target({FIELD, PARAMETER, RECORD_COMPONENT, TYPE_USE})
@Retention(RUNTIME)
public @interface Latitude {
    String message() default "纬度必须在 -90 到 90 之间";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
