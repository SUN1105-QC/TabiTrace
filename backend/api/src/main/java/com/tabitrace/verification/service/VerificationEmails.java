package com.tabitrace.verification.service;

import com.tabitrace.verification.VerificationPurpose;

/** 验证码相关邮件的主题与正文（纯文本 + HTML 两个版本） */
final class VerificationEmails {
    private VerificationEmails() {}

    record Mail(String subject, String text, String html) {}

    static final String CODE_SUBJECT = "【旅迹】你的邮箱验证码";

    private static String action(VerificationPurpose purpose) {
        return switch (purpose) {
            case REGISTER -> "创建旅迹账号";
            case RESET_PASSWORD -> "重置旅迹账号密码";
            case CHANGE_EMAIL -> "修改旅迹账号的登录邮箱";
        };
    }

    static Mail code(VerificationPurpose purpose, String code, long ttlSeconds) {
        long minutes = Math.max(1, ttlSeconds / 60);
        String action = action(purpose);
        String text = """
            你好，

            你正在%s，本次的邮箱验证码是：

                %s

            验证码 %d 分钟内有效，只能使用一次。

            安全提示：旅迹的工作人员不会向你索要验证码，请不要把它告诉任何人。
            如果这不是你本人的操作，请忽略这封邮件，你的邮箱不会被用于注册。

            —— 旅迹 TabiTrace
            """.formatted(action, code, minutes);
        String html = """
            <div style="margin:0;padding:32px 16px;background:#F8F4EE;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#26221E">
              <div style="max-width:480px;margin:0 auto;padding:32px 28px;border-radius:20px;background:#FFFDFA;border:1px solid #EBE1D5">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.18em;color:#E97A33">TABITRACE · 旅迹</p>
                <h1 style="margin:10px 0 0;font-size:22px;font-weight:600">你的邮箱验证码</h1>
                <p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#5F574F">你正在%s，请在页面中输入下面的验证码：</p>
                <p style="margin:20px 0;padding:16px 0;border-radius:14px;background:#FCEDE0;text-align:center;font-size:32px;font-weight:700;letter-spacing:.3em;color:#26221E">%s</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5F574F">验证码 <b>%d 分钟</b>内有效，只能使用一次。</p>
                <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #EFE6DA;font-size:12.5px;line-height:1.7;color:#8A8078">安全提示：旅迹的工作人员不会向你索要验证码，请不要把它告诉任何人。如果这不是你本人的操作，请忽略这封邮件，你的邮箱不会被用于注册。</p>
                <p style="margin:18px 0 0;font-size:13px;color:#5F574F">—— 旅迹 TabiTrace</p>
              </div>
            </div>
            """.formatted(action, code, minutes);
        return new Mail(CODE_SUBJECT, text, html);
    }

    /**
     * 邮箱已经注册时，注册验证码接口不会发验证码，而是发这封提醒：
     * 接口对外的响应与正常发送完全一致（防止通过接口探测邮箱是否注册），真正的邮箱主人则能从邮件里知道该去登录。
     */
    static Mail accountExists(String loginUrl) {
        String text = """
            你好，

            有人（可能是你自己）正在用这个邮箱创建旅迹账号，但这个邮箱已经有旅迹账号了，所以我们没有发送验证码。

            如果是你本人，直接登录即可：%s

            如果这不是你本人的操作，请忽略这封邮件，你的账号不会有任何变化。

            —— 旅迹 TabiTrace
            """.formatted(loginUrl);
        String html = """
            <div style="margin:0;padding:32px 16px;background:#F8F4EE;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#26221E">
              <div style="max-width:480px;margin:0 auto;padding:32px 28px;border-radius:20px;background:#FFFDFA;border:1px solid #EBE1D5">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.18em;color:#E97A33">TABITRACE · 旅迹</p>
                <h1 style="margin:10px 0 0;font-size:22px;font-weight:600">这个邮箱已经有旅迹账号</h1>
                <p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#5F574F">有人（可能是你自己）正在用这个邮箱创建旅迹账号。因为这个邮箱已经注册过，我们没有发送验证码。</p>
                <p style="margin:22px 0"><a href="%s" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#E97A33;color:#fff;font-size:14px;font-weight:700;text-decoration:none">直接登录旅迹</a></p>
                <p style="margin:0;padding-top:16px;border-top:1px solid #EFE6DA;font-size:12.5px;line-height:1.7;color:#8A8078">如果这不是你本人的操作，请忽略这封邮件，你的账号不会有任何变化。</p>
                <p style="margin:18px 0 0;font-size:13px;color:#5F574F">—— 旅迹 TabiTrace</p>
              </div>
            </div>
            """.formatted(loginUrl);
        return new Mail("【旅迹】这个邮箱已经有旅迹账号", text, html);
    }
}
