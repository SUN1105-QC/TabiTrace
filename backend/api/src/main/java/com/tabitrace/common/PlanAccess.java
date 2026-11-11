package com.tabitrace.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 「全部功能免费开放」开关（app.plans.open-access / 环境变量 PLANS_OPEN_ACCESS）。
 * 开启时：新旅行直接是 PRO、已有 FREE 旅行在启动时升级为 PRO（之后即使关闭开关也保留 PRO）、
 * 所有账号视为有效会员、不再受理新的付款。视频成本限额（每日次数 / 时长、全站并发）不受影响。
 * 所有付费判断只看这一处，不要在业务代码里另读配置。
 */
@Component
public class PlanAccess {
    /** 手动构造的服务（单元测试）默认使用：保持原有付费规则 */
    public static final PlanAccess CLOSED = new PlanAccess(false);

    private final boolean openAccess;

    public PlanAccess(@Value("${app.plans.open-access:false}") boolean openAccess) { this.openAccess = openAccess; }

    public boolean open() { return openAccess; }
}
