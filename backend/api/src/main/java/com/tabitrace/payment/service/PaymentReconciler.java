package com.tabitrace.payment.service;

import com.tabitrace.payment.mapper.PaymentMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Bounded repair loop; may recover Checkout creation with the original key, never charges or refunds. */
@Component
public class PaymentReconciler {
    private final PaymentMapper mapper;
    private final PaymentService payments;
    private final boolean enabled;
    private final int batchSize, intervalSeconds, settledSeconds;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PaymentReconciler.class);
    public PaymentReconciler(PaymentMapper mapper, PaymentService payments,
                            @Value("${app.payments.reconcile.enabled:true}") boolean enabled,
                            @Value("${app.payments.reconcile.batch-size:10}") int batchSize,
                            @Value("${app.payments.reconcile.min-age-seconds:300}") int intervalSeconds,
                            @Value("${app.payments.reconcile.settled-age-seconds:86400}") int settledSeconds) {
        this.mapper=mapper; this.payments=payments; this.enabled=enabled;
        this.batchSize=Math.max(1,Math.min(batchSize,100)); this.intervalSeconds=Math.max(60,intervalSeconds);
        this.settledSeconds=Math.max(3600,settledSeconds);
    }
    @Scheduled(fixedDelayString="${app.payments.reconcile.interval-ms:60000}", initialDelayString="${app.payments.reconcile.interval-ms:60000}")
    public void reconcile() {
        if (!enabled || !payments.realPayments() || !payments.paymentsAvailable()) return;
        for (Long id : mapper.reconcileIds(intervalSeconds,settledSeconds,batchSize)) {
            try { payments.reconcile(id); }
            catch (Exception e) {
                // Back off failed orders as well, so a bad order cannot starve the queue.
                mapper.touched(id); log.warn("PAYMENT reconciliation failed order={} reason={}",id,e.getClass().getSimpleName());
            }
        }
    }
}
