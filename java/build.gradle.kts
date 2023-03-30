plugins {
    id("java")
}

val projectGroup = "kr.jclab.graphql"
val projectVersion = Version.PROJECT

allprojects {
    group = projectGroup
    version = Version.PROJECT
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.8.1")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.8.1")
}

tasks.getByName<Test>("test") {
    useJUnitPlatform()
}
