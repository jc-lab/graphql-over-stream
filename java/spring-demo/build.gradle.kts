plugins {
    java
    id("org.springframework.boot") version "2.7.10"
    id("io.spring.dependency-management") version "1.0.15.RELEASE"
    id("com.graphql_java_generator.graphql-gradle-plugin") version "1.18.6"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"
java.sourceCompatibility = JavaVersion.VERSION_11

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-graphql")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    compileOnly("org.projectlombok:lombok")
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")
    annotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework:spring-webflux")
    testImplementation("org.springframework.graphql:spring-graphql-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}


generatePojoConf {
    packageName = "$group.graphql"
    setSchemaFileFolder("$projectDir/src/main/resources/graphql")
    mode = com.graphql_java_generator.plugin.conf.PluginMode.server
}

sourceSets {
    named("main") {
        java.srcDirs("$buildDir/generated/sources/graphqlGradlePlugin")
    }
}

tasks {
    jar {
        enabled = false
    }
    compileJava {
        dependsOn("generatePojo")
    }
}
