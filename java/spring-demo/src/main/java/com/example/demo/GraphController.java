package com.example.demo;

import com.example.graphql.TestInput;
import com.example.graphql.TestOutput;
import org.reactivestreams.Subscriber;
import org.reactivestreams.Subscription;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SubscriptionMapping;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Controller;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

@Controller
public class GraphController {
    private AtomicReference<Subscriber<? super TestOutput>> subscriber = new AtomicReference<>();

    private final ConcurrentHashMap<String, TestOutput> map = new ConcurrentHashMap<>() {{
        TestOutput item = new TestOutput();
        item.setId("1");
        item.setName("sample");
        put("1", item);
    }};


    @QueryMapping("testList")
    public List<TestOutput> testList() {
        return new ArrayList<>(map.values());
    }

    @QueryMapping("testGet")
    public @Nullable TestOutput testGet(@Argument("id") String id) {
        return map.get(id);
    }

    @MutationMapping("testAdd")
    public TestOutput testAdd(@Argument("input") TestInput input) {
        TestOutput item = new TestOutput();
        item.setId(UUID.randomUUID().toString());
        item.setName(input.getName());
        map.put(item.getId(), item);

        Subscriber<? super TestOutput> s = subscriber.get();
        if (s != null) {
            s.onNext(item);
        }

        return item;
    }

    @SubscriptionMapping("testAdded")
    public Flux<TestOutput> testAdded() {
        return Flux.from(p -> {
            p.onSubscribe(new Subscription() {
                @Override
                public void request(long n) {
                    System.out.println("subscribe n=" + n);
                }

                @Override
                public void cancel() {
                    subscriber.compareAndSet(p, null);
                }
            });
            subscriber.set(p);
        });
    }
}
