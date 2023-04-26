package kr.jclab.graphql.netty_spring;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.util.internal.logging.InternalLogger;
import io.netty.util.internal.logging.InternalLoggerFactory;
import kr.jclab.graphql.netty_spring.exception.GraphQlCloseException;
import kr.jclab.graphql.netty_spring.exception.SubscriptionExistsException;
import org.reactivestreams.Publisher;
import org.reactivestreams.Subscription;
import org.springframework.graphql.ExecutionGraphQlRequest;
import org.springframework.graphql.ExecutionGraphQlResponse;
import org.springframework.graphql.ExecutionGraphQlService;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.graphql.execution.SubscriptionPublisherException;
import org.springframework.graphql.server.support.GraphQlWebSocketMessage;
import org.springframework.graphql.support.DefaultExecutionGraphQlRequest;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import reactor.core.publisher.BaseSubscriber;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class GraphQlSessionHandler {
    private InternalLogger logger = InternalLoggerFactory.getInstance(this.getClass());

    private final ExecutionGraphQlService executionGraphQlService;
    private final ObjectMapper objectMapper;
    private final ChannelHandlerContext ctx;
    private final GraphQlPayloadEncoder payloadEncoder;

    private final String sessionId;


    private final AtomicReference<Map<String, Object>> connectionInitPayloadRef = new AtomicReference<>();
    private final Map<String, Subscription> subscriptions = new ConcurrentHashMap<>();
    private final Scheduler scheduler;

    public GraphQlSessionHandler(
            ObjectMapper objectMapper,
            ExecutionGraphQlService executionGraphQlService,
            ChannelHandlerContext ctx,
            GraphQlPayloadEncoder payloadEncoder,
            String sessionId
    ) {
        this.objectMapper = objectMapper;
        this.executionGraphQlService = executionGraphQlService;
        this.ctx = ctx;
        this.payloadEncoder = payloadEncoder;
        this.sessionId = sessionId;
        this.scheduler = Schedulers.newSingle("GraphQL-NettySession-" + sessionId);
    }

    public void handleMessage(Object msg) throws Exception {
        try {
            if (msg instanceof ByteBuf) {
                handleMessage(((ByteBuf) msg).toString(StandardCharsets.UTF_8));
            } else if (msg instanceof String) {
                handleMessage((String) msg);
            } else if (msg instanceof byte[]) {
                handleMessage(new String((byte[]) msg, StandardCharsets.UTF_8));
            } else if (msg instanceof ByteBuffer) {
                ByteBuffer buffer = (ByteBuffer) msg;
                if (buffer.hasArray()) {
                    handleMessage(new String(buffer.array(), buffer.arrayOffset(), buffer.remaining()));
                } else {
                    byte[] temp = new byte[buffer.remaining()];
                    buffer.get(temp);
                    handleMessage(new String(temp, StandardCharsets.UTF_8));
                }
            } else {
                throw new RuntimeException("Not supported type: " + msg.getClass());
            }
        } catch (Exception e) {
            logger.warn("channelRead failed", e);
            throw e;
        }
    }

    public void handleMessage(String data) throws JsonProcessingException {
        if (logger.isDebugEnabled()) {
            logger.debug("handleMessage: " + data);
        }

        GraphQlWebSocketMessage message = objectMapper.readValue(data, GraphQlWebSocketMessage.class);
        String id = message.getId();
        Map<String, Object> payload = message.getPayload();

        switch (message.resolvedType()) {
            case CONNECTION_INIT:
                if (!setConnectionInitPayload(payload)) {
                    closeSession(GraphQlStatus.TOO_MANY_INIT_REQUESTS_STATUS);
                    return;
                }

                GraphQlWebSocketMessage responseMessage = GraphQlWebSocketMessage.connectionAck(Collections.emptyMap());
                sendMessage(responseMessage);
                return;
            case SUBSCRIBE:
                if (connectionInitPayloadRef.get() == null) {
                    closeSession(GraphQlStatus.UNAUTHORIZED_STATUS);
                    return;
                }
                if (id == null) {
                    closeSession(GraphQlStatus.INVALID_MESSAGE_STATUS);
                    return;
                }

                ExecutionGraphQlRequest request = buildRequest(message);
                if (logger.isDebugEnabled()) {
                    logger.debug("Executing: " + request);
                }
                executionGraphQlService.execute(request)
                        .flatMapMany((response) -> handleResponse(ctx, request.getId(), response))
                        .publishOn(scheduler) // Serial blocking send via single thread
                        .subscribe(new SendMessageSubscriber(id));
                return;
            case PING:
                sendMessage(GraphQlWebSocketMessage.pong(null));
                return;
            case COMPLETE:
                if (id != null) {
                    Subscription subscription = subscriptions.remove(id);
                    if (subscription != null) {
                        subscription.cancel();
                    }
                }
                return;
            default:
                closeSession(GraphQlStatus.INVALID_MESSAGE_STATUS);
        }
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

    private boolean setConnectionInitPayload(Map<String, Object> payload) {
        return this.connectionInitPayloadRef.compareAndSet(null, payload);
    }

    private void sendMessage(GraphQlWebSocketMessage message) {
        try {
            ctx.writeAndFlush(payloadEncoder.encode(objectMapper.writeValueAsString(message)));
        } catch (JsonProcessingException e) {
            logger.warn("json encode failed", e);
            ctx.fireExceptionCaught(e);
        }
    }

    protected DefaultExecutionGraphQlRequest buildRequest(GraphQlWebSocketMessage message) {
        String id = message.getId();
        Map<String, Object> body = message.getPayload();
        return new DefaultExecutionGraphQlRequest(
                getKey("query", body),
                getKey("operationName", body),
                getKey("variables", body),
                getKey("extensions", body),
                message.getId(),
                null
        );
    }

    @SuppressWarnings("unchecked")
    private Flux<GraphQlWebSocketMessage> handleResponse(ChannelHandlerContext ctx, String id, ExecutionGraphQlResponse response) {
        if (logger.isDebugEnabled()) {
            logger.debug("Execution result ready"
                    + (!CollectionUtils.isEmpty(response.getErrors()) ? " with errors: " + response.getErrors() : "")
                    + ".");
        }
        Flux<Map<String, Object>> responseFlux;
        if (response.getData() instanceof Publisher) {
            // Subscription
            responseFlux = Flux.from((Publisher<ExecutionResult>) response.getData())
                    .map(ExecutionResult::toSpecification)
                    .doOnSubscribe((subscription) -> {
                        Subscription prev = subscriptions.putIfAbsent(id, subscription);
                        if (prev != null) {
                            throw new SubscriptionExistsException();
                        }
                    });
        }
        else {
            // Single response (query or mutation) that may contain errors
            responseFlux = Flux.just(response.toMap());
        }

        return responseFlux
                .map(responseMap -> GraphQlWebSocketMessage.next(id, responseMap))
                .concatWith(Mono.fromCallable(() -> GraphQlWebSocketMessage.complete(id)))
                .onErrorResume((ex) -> {
                    if (ex instanceof SubscriptionExistsException) {
                        GraphQlStatus.CloseStatus status = new GraphQlStatus.CloseStatus(4409, "Subscriber for " + id + " already exists");
                        closeSession(status);
                        return Flux.empty();
                    }
                    List<GraphQLError> errors = ((ex instanceof SubscriptionPublisherException) ?
                            ((SubscriptionPublisherException) ex).getErrors() :
                            Collections.singletonList(GraphqlErrorBuilder.newError()
                                    .message("Subscription error")
                                    .errorType(ErrorType.INTERNAL_ERROR)
                                    .build()));
                    return Mono.just(GraphQlWebSocketMessage.error(id, errors));
                });
    }

    private class SendMessageSubscriber extends BaseSubscriber<GraphQlWebSocketMessage> {
        private final String subscriptionId;

        SendMessageSubscriber(String subscriptionId) {
            this.subscriptionId = subscriptionId;
        }

        @Override
        protected void hookOnSubscribe(Subscription subscription) {
            subscription.request(1);
        }

        @Override
        protected void hookOnNext(GraphQlWebSocketMessage nextMessage) {
            try {
                sendMessage(nextMessage);
                request(1);
            }
            catch (Exception ex) {
                tryCloseWithError(ex, logger);
            }
        }

        @Override
        public void hookOnError(Throwable ex) {
            tryCloseWithError(ex, logger);
        }

        @Override
        public void hookOnComplete() {
            subscriptions.remove(this.subscriptionId);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T getKey(String key, Map<String, Object> body) {
        if (key.equals("query") && !StringUtils.hasText((String) body.get(key))) {
            throw new RuntimeException("No \"query\" in the request document");
        }
        return (T) body.get(key);
    }

    private void tryCloseWithError(Throwable ex, InternalLogger logger) {
        logger.error("Closing session due to exception for " + sessionId, ex);
        try {
            closeSession(GraphQlStatus.INTERNAL_ERROR);
        } catch (Exception e) {}
    }

    private void closeSession(int code, String reason) {
        ctx.fireExceptionCaught(new GraphQlCloseException(code, reason));
    }

    private void closeSession(GraphQlStatus.CloseStatus status) {
        closeSession(status.getCode(), status.getReason());
    }
}
