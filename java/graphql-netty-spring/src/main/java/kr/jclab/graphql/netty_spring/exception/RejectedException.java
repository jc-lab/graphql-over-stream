package kr.jclab.graphql.netty_spring.exception;

public class RejectedException extends Exception {
    public RejectedException() {
    }

    public RejectedException(String message) {
        super(message);
    }

    public RejectedException(String message, Throwable cause) {
        super(message, cause);
    }

    public RejectedException(Throwable cause) {
        super(cause);
    }

    public RejectedException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}
