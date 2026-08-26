plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.airplaystatus.alwayson"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.airplaystatus.alwayson"
        minSdk = 26 // OD2
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        // Config (OD: DISPLAY_URL etc). Override with -P or local.properties as needed.
        buildConfigField("String", "DISPLAY_URL", "\"http://airplay-status.home.arpa:3003/display?client=android\"")
        buildConfigField("String", "STATUS_URL", "\"http://airplay-status.home.arpa:3003\"")
        buildConfigField("String", "FALLBACK_URL", "\"\"")
        buildConfigField("int", "IDLE_GRACE_SEC", "45")
        buildConfigField("int", "POLL_SEC", "5")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation("junit:junit:4.13.2")
}
