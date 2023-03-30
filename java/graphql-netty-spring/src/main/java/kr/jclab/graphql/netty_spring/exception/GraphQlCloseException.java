package kr.jclab.graphql.netty_spring.exception;

public class GraphQlCloseException extends Exception {
    private final int code;
    private final String reason;

    public GraphQlCloseException(int code, String reason) {
        super(reason);
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
