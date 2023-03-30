package kr.jclab.graphql.netty_spring;

@FunctionalInterface
public interface GraphQlPayloadEncoder {
    Object encode(String input);
}
