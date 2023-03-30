package kr.jclab.graphql.netty_spring;

public class GraphQlStatus {
    public static final CloseStatus INTERNAL_ERROR = new CloseStatus(1011, "Internal error");

    public static final CloseStatus INVALID_MESSAGE_STATUS = new CloseStatus(4400, "Invalid message");

    public static final CloseStatus UNAUTHORIZED_STATUS = new CloseStatus(4401, "Unauthorized");

    public static final CloseStatus INIT_TIMEOUT_STATUS = new CloseStatus(4408, "Connection initialisation timeout");

    public static final CloseStatus TOO_MANY_INIT_REQUESTS_STATUS = new CloseStatus(4429, "Too many initialisation requests");

    public static class CloseStatus {
        private final int code;
        private final String reason;

        public CloseStatus(int code, String reason) {
            this.code = code;
            this.reason = reason;
        }

        public int getCode() {
            return code;
        }

        public String getReason() {
            return reason;
        }
    }
}
