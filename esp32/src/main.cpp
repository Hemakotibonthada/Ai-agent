// ============================================================
// Nexus AI OS - ESP32 Home Automation Firmware
// Main Entry Point
// ============================================================
//
// Hardware connections:
//   GPIO  4  - DHT22 (temperature/humidity)
//   GPIO 34  - MQ-135 (air quality, analog)
//   GPIO 35  - MQ-2 (gas leak, analog)
//   GPIO  5  - HC-SR04 trigger
//   GPIO 18  - HC-SR04 echo
//   GPIO 19  - PIR motion sensor
//   GPIO 36  - SCT-013 current sensor (analog, VP)
//   GPIO 21  - Reed switch 1 (door)
//   GPIO 22  - Reed switch 2 (window)
//   GPIO 13  - Relay: Light 1
//   GPIO 12  - Relay: Light 2
//   GPIO 14  - Relay: Light 3
//   GPIO 27  - Relay: Light 4
//   GPIO 26  - Relay: Fan
//   GPIO 25  - Fan PWM speed
//   GPIO 15  - IR LED (AC control)
//   GPIO  2  - Buzzer
//   GPIO 23  - WS2812B NeoPixel strip
//
// Communication:
//   WiFi -> MQTT broker (home automation)
//   WiFi -> HTTP (local dashboard)
//   WiFi -> WebSocket (real-time updates)
//
// ============================================================

#include <Arduino.h>
#include "config.h"
#include "utils.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "sensors.h"
#include "actuators.h"
#include "power_monitor.h"
#include "web_server.h"
#include <ArduinoOTA.h>

// ---- State ----
static unsigned long g_last_status_led = 0;
static unsigned long g_last_alert_check = 0;
static unsigned long g_last_heap_report = 0;
static bool g_system_ready = false;

// ---- Alert State (prevent repeat alerts) ----
static bool g_alert_gas_sent      = false;
static bool g_alert_water_sent    = false;
static bool g_alert_temp_hi_sent  = false;
static bool g_alert_temp_lo_sent  = false;
static bool g_alert_power_sent    = false;

// ---- Forward declarations ----
void check_alerts();
void update_status_led();
void setup_ota();
void print_banner();
void enter_deep_sleep();

// ============================================================
// SETUP
// ============================================================
void setup() {
    // Serial init
    Serial.begin(115200);
    delay(500);
    print_banner();

    // Initialize utilities (preferences, NTP, watchdog)
    utils_init();
    LOG_I("MAIN", "Starting Nexus Home ESP32 Firmware v%d.%d.%d",
          FW_VERSION_MAJOR, FW_VERSION_MINOR, FW_VERSION_PATCH);
    LOG_I("MAIN", "Device ID: %s", DEVICE_ID);
    LOG_I("MAIN", "Free heap: %u bytes", get_free_heap());

    // Initialize sensors
    LOG_I("MAIN", "Initializing sensors...");
    sensors_init();

    // Initialize actuators
    LOG_I("MAIN", "Initializing actuators...");
    actuators_init();

    // Initialize power monitor
    LOG_I("MAIN", "Initializing power monitor...");
    power_init();

    // Startup indication
    neopixel_set_color(0, 0, 255);  // Blue = starting up
    buzzer_beep(1000, 100);

    // Initialize WiFi
    LOG_I("MAIN", "Initializing WiFi...");
    wifi_init();

    if (wifi_is_connected()) {
        neopixel_set_color(0, 255, 0);  // Green = connected
        buzzer_success();

        // Initialize MQTT
        LOG_I("MAIN", "Initializing MQTT...");
        mqtt_init();

        // Initialize web server
        LOG_I("MAIN", "Initializing web server...");
        webserver_init();

        // Setup OTA
        setup_ota();

        // Initial MQTT connection
        mqtt_connect();
    } else {
        neopixel_set_color(255, 165, 0);  // Orange = AP mode
        LOG_W("MAIN", "WiFi not connected, running in AP mode");

        // Still start web server for config
        webserver_init();
    }

    g_system_ready = true;
    LOG_I("MAIN", "=== System Ready ===");
    LOG_I("MAIN", "Free heap: %u bytes", get_free_heap());

    // Breathe green to indicate ready
    neopixel_animation_breathing(0, 255, 0);
}

// ============================================================
// LOOP
// ============================================================
void loop() {
    unsigned long now = millis();

    // ---- Core module loops ----
    utils_loop();         // Watchdog feed, NTP update
    wifi_loop();          // WiFi reconnect
    mqtt_loop();          // MQTT reconnect + periodic publish
    sensors_loop();       // Read all sensors
    actuators_loop();     // Animations, dimming, buzzer patterns
    power_loop();         // Power measurement + accumulation
    webserver_loop();     // WebSocket broadcasts

    // ---- OTA handling ----
    ArduinoOTA.handle();

    // ---- Alert checking (every 2 seconds) ----
    if (now - g_last_alert_check >= 2000) {
        g_last_alert_check = now;
        check_alerts();
    }

    // ---- Status LED update (every 5 seconds) ----
    if (now - g_last_status_led >= 5000) {
        g_last_status_led = now;
        update_status_led();
    }

    // ---- Heap reporting (every 60 seconds) ----
    if (now - g_last_heap_report >= 60000) {
        g_last_heap_report = now;
        LOG_D("MAIN", "Heap: %u bytes | Uptime: %s | MQTT msgs TX:%u RX:%u",
              get_free_heap(), get_uptime_string().c_str(),
              mqtt_get_messages_sent(), mqtt_get_messages_received());
    }

    // ---- Deep sleep check ----
    #if DEEP_SLEEP_ENABLED
    if (get_uptime_seconds() > 0 && !mqtt_is_connected() && !wifi_is_connected()) {
        LOG_I("MAIN", "No connectivity, entering deep sleep for %d seconds", DEEP_SLEEP_DURATION);
        enter_deep_sleep();
    }
    #endif

    // Small yield to prevent WDT on tight loops
    yield();
}

// ============================================================
// Alert Checking
// ============================================================
void check_alerts() {
    SensorData sd = sensors_get_data();
    PowerData pd  = power_get_data();

    // ---- Gas Leak ----
    if (sd.gas_leak_detected && !g_alert_gas_sent) {
        g_alert_gas_sent = true;
        buzzer_alert_gas();
        neopixel_animation_alert();
        mqtt_publish_alert("gas_leak", "Gas leak detected! Immediate attention required.", 3);
        LOG_E("ALERT", "*** GAS LEAK DETECTED ***");
    } else if (!sd.gas_leak_detected && g_alert_gas_sent) {
        g_alert_gas_sent = false;
        buzzer_stop();
        mqtt_publish_alert("gas_leak_cleared", "Gas levels returned to normal.", 1);
        LOG_I("ALERT", "Gas leak cleared");
    }

    // ---- Water Level Low ----
    if (sd.water_level_pct < WATER_LEVEL_LOW && sd.water_level_pct > 0 && !g_alert_water_sent) {
        g_alert_water_sent = true;
        buzzer_alert_water();
        mqtt_publish_alert("water_low", "Water tank level critically low!", 2);
        LOG_W("ALERT", "Water level low: %.1f%%", sd.water_level_pct);
    } else if (sd.water_level_pct >= WATER_LEVEL_LOW + 5 && g_alert_water_sent) {
        g_alert_water_sent = false;
        buzzer_stop();
        LOG_I("ALERT", "Water level recovered: %.1f%%", sd.water_level_pct);
    }

    // ---- Temperature High ----
    if (sd.temperature > TEMP_HIGH_THRESHOLD && !g_alert_temp_hi_sent) {
        g_alert_temp_hi_sent = true;
        mqtt_publish_alert("temp_high", "High temperature alert!", 2);
        LOG_W("ALERT", "Temperature high: %.1f°C", sd.temperature);
    } else if (sd.temperature < TEMP_HIGH_THRESHOLD - 2 && g_alert_temp_hi_sent) {
        g_alert_temp_hi_sent = false;
    }

    // ---- Temperature Low ----
    if (sd.temperature < TEMP_LOW_THRESHOLD && sd.temperature > -40 && !g_alert_temp_lo_sent) {
        g_alert_temp_lo_sent = true;
        mqtt_publish_alert("temp_low", "Low temperature alert!", 2);
        LOG_W("ALERT", "Temperature low: %.1f°C", sd.temperature);
    } else if (sd.temperature > TEMP_LOW_THRESHOLD + 2 && g_alert_temp_lo_sent) {
        g_alert_temp_lo_sent = false;
    }

    // ---- Motion (in away mode) ----
    if (sd.motion_detected && scene_get_active() == "away") {
        buzzer_alert_motion();
        mqtt_publish_alert("motion_intrusion", "Motion detected in AWAY mode!", 3);
        LOG_W("ALERT", "Intrusion: motion in away mode!");
    }

    // ---- Power Anomaly ----
    if (pd.anomaly_detected && !g_alert_power_sent) {
        g_alert_power_sent = true;
        mqtt_publish_alert("power_spike", "Abnormal power consumption detected!", 2);
        LOG_W("ALERT", "Power anomaly: %.1fW", pd.power_watts);
    } else if (!pd.anomaly_detected && g_alert_power_sent) {
        g_alert_power_sent = false;
    }
}

// ============================================================
// Status LED Update
// ============================================================
void update_status_led() {
    // Don't override active alerts or scenes
    if (g_alert_gas_sent) return;
    if (scene_get_active() != "none") return;

    if (!wifi_is_connected()) {
        neopixel_animation_breathing(255, 165, 0);  // Orange breathing = no WiFi
    } else if (!mqtt_is_connected()) {
        neopixel_animation_breathing(255, 255, 0);  // Yellow breathing = no MQTT
    } else if (!sensors_is_warmed_up()) {
        neopixel_animation_breathing(0, 0, 255);    // Blue breathing = warming up
    } else {
        // All good - show first 4 pixels as device status
        neopixel_clear();
        // Pixel 0: WiFi (green=connected)
        neopixel_set_pixel(0, 0, 255, 0);
        // Pixel 1: MQTT
        neopixel_set_pixel(1, mqtt_is_connected() ? 0 : 255,
                              mqtt_is_connected() ? 255 : 0, 0);
        // Pixel 2: Air quality
        int aqi = sensor_read_air_quality_raw();
        if (aqi < 200) neopixel_set_pixel(2, 0, 255, 0);        // Good
        else if (aqi < 400) neopixel_set_pixel(2, 255, 165, 0);  // Moderate
        else neopixel_set_pixel(2, 255, 0, 0);                    // Bad

        // Pixel 3: General status
        neopixel_set_pixel(3, 0, 0, 255);
    }
}

// ============================================================
// OTA Setup
// ============================================================
void setup_ota() {
    ArduinoOTA.setHostname("nexus-home");
    ArduinoOTA.setPassword(OTA_PASSWORD);

    ArduinoOTA.onStart([]() {
        String type = (ArduinoOTA.getCommand() == U_FLASH) ? "firmware" : "filesystem";
        LOG_I("OTA", "Start updating %s", type.c_str());
        neopixel_set_color(0, 0, 255);
        mqtt_publish_status("updating");
    });

    ArduinoOTA.onEnd([]() {
        LOG_I("OTA", "Update complete!");
        neopixel_set_color(0, 255, 0);
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        int pct = (progress / (total / 100));
        // Show progress on NeoPixel strip
        int leds_on = map(pct, 0, 100, 0, NEOPIXEL_COUNT);
        for (int i = 0; i < NEOPIXEL_COUNT; i++) {
            if (i < leds_on) neopixel_set_pixel(i, 0, 0, 255);
            else neopixel_set_pixel(i, 0, 0, 0);
        }
        if (pct % 10 == 0) {
            LOG_I("OTA", "Progress: %u%%", pct);
        }
    });

    ArduinoOTA.onError([](ota_error_t error) {
        LOG_E("OTA", "Error[%u]: ", error);
        neopixel_set_color(255, 0, 0);
        buzzer_error();
    });

    ArduinoOTA.begin();
    LOG_I("OTA", "OTA ready. Hostname: nexus-home");
}

// ============================================================
// Deep Sleep
// ============================================================
void enter_deep_sleep() {
    LOG_I("MAIN", "Preparing for deep sleep...");

    // Save power data before sleep
    power_save_data();

    // Publish offline status
    mqtt_publish_status("sleeping");
    mqtt_disconnect();

    // Turn off actuators
    light_all_off();
    fan_set(false);
    neopixel_clear();
    buzzer_stop();

    LOG_I("MAIN", "Entering deep sleep for %d seconds", DEEP_SLEEP_DURATION);
    Serial.flush();

    // Configure wake-up source: timer + GPIO (PIR for motion wake)
    esp_sleep_enable_timer_wakeup((uint64_t)DEEP_SLEEP_DURATION * 1000000ULL);
    esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_PIR, HIGH);

    esp_deep_sleep_start();
}

// ============================================================
// Startup Banner
// ============================================================
void print_banner() {
    Serial.println();
    Serial.println("╔═══════════════════════════════════════════╗");
    Serial.println("║     NEXUS AI OS - Home Automation         ║");
    Serial.println("║     ESP32 Firmware v1.0.0                 ║");
    Serial.println("║     (c) 2026 Nexus AI Systems             ║");
    Serial.println("╚═══════════════════════════════════════════╝");
    Serial.println();
    Serial.printf("  Chip:    %s Rev %d\n", ESP.getChipModel(), ESP.getChipRevision());
    Serial.printf("  Cores:   %d\n", ESP.getChipCores());
    Serial.printf("  Flash:   %s (%dMHz)\n",
                  String(ESP.getFlashChipSize() / 1024 / 1024).c_str() + String("MB"),
                  ESP.getFlashChipSpeed() / 1000000);
    Serial.printf("  PSRAM:   %s\n", ESP.getPsramSize() > 0 ? "Yes" : "No");
    Serial.printf("  SDK:     %s\n", ESP.getSdkVersion());
    Serial.printf("  MAC:     %s\n", WiFi.macAddress().c_str());
    Serial.println();
}
