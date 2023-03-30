package kr.jclab.graphql.netty_spring.internal;

import io.netty.channel.ChannelHandlerContext;
import org.reactivestreams.Subscription;
import org.springframework.graphql.server.WebSocketSessionInfo;
import org.springframework.lang.Nullable;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class SessionState {
    private final ChannelHandlerContext ctx;

    private final AtomicReference<Map<String, Object>> connectionInitPayloadRef = new AtomicReference<>();

    private final Map<String, Subscription> subscriptions = new ConcurrentHashMap<>();

    private final Scheduler scheduler;

    public SessionState(ChannelHandlerContext ctx, String graphQlSessionId) {
        this.ctx = ctx;
        this.scheduler = Schedulers.newSingle("GraphQL-NettySession-" + graphQlSessionId);
    }

    public ChannelHandlerContext getCtx() {
        return ctx;
    }

    @Nullable
    public Map<String, Object> getConnectionInitPayload() {
        return this.connectionInitPayloadRef.get();
    }

    public boolean setConnectionInitPayload(Map<String, Object> payload) {
        return this.connectionInitPayloadRef.compareAndSet(null, payload);
    }


    public Map<String, Subscription> getSubscriptions() {
        return this.subscriptions;
    }

    public void dispose() {
        for (Map.Entry<String, Subscription> entry : this.subscriptions.entrySet()) {
            try {
                entry.getValue().cancel();
            }
            catch (Throwable ex) {
                // Ignore and keep on
            }
        }
        this.subscriptions.clear();
        this.scheduler.dispose();
    }

    public Scheduler getScheduler() {
        return this.scheduler;
    }
}
