package com.tabitrace.worker;

/**
 * 可以直接展示给用户的失败原因。code 写入 video_projects.error_code，前端按它显示友好标题；
 * message 是给用户看的摘要，detail（如 ffmpeg 输出尾部）只拼在后面供排查。
 */
public class RenderFailure extends Exception {
    private final String code;

    public RenderFailure(String code, String message) {
        super(message);
        this.code = code;
    }

    public RenderFailure(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() { return code; }
}
