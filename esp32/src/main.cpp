// ============================================================
// Nexus AI OS - ESP32 Home Automation Firmware v2.0
// Main Entry Point — Enhanced with EEPROM State Persistence
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
// Key v2.0 Features:
//   - Full EEPROM/NVS state persistence (survives power loss)
//   - Boot reason detection & safe mode
//   - Scheduled timers with NVS persistence
//   - Watchdog with early warning
//   - Heap monitoring & fragmentation detection
//   - Alert cooldown system
//   - Auto-save with dirty flag debouncing
//   - Relay protection (cycle counting)
//   - Diagnostic reporting via MQTT
//
// ============================================================

#include <Arduino.h>
#include <esp_system.h>
#include "config.h"
#include "utils.h"
#include "eeprom_manager.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "sensors.h"
#include "actuators.h"
#include "power_monitor.h"
#include "web_server.h"
#include <ArduinoOTA.h>

// ============================================================
// Global State
// ============================================================

// ---- Core timers ----
static unsigned long g_last_status_led     = 0;
static unsigned long g_last_alert_check    = 0;
static unsigned long g_last_heap_report    = 0;
static unsigned long g_last_timer_check    = 0;
static unsigned long g_last_diag_report    = 0;
static unsigned long g_last_auto_save      = 0;
static unsigned long g_last_uptime_save    = 0;
static bool          g_system_ready        = false;
static bool          g_safe_mode           = false;

// ---- Alert State (prevent repeat alerts + cooldown) ----
static bool          g_alert_gas_sent      = false;
static bool          g_alert_water_sent    = false;
static bool          g_alert_temp_hi_sent  = false;
static bool          g_alert_temp_lo_sent  = false;
static bool          g_alert_power_sent    = false;
static bool          g_alert_humidity_sent = false;
static bool          g_alert_heap_sent     = false;
static unsigned long g_last_alert_time     = 0;

// ---- User preferences (loaded from EEPROM) ----
static UserPreferences g_user_prefs;

// ---- Scheduled timers ----
static ScheduledTimer g_timers[MAX_SCHEDULED_TIMERS];
static int            g_timer_count = 0;

// ---- Boot diagnostics ----
static uint32_t      g_min_heap_seen = UINT32_MAX;
static uint32_t      g_loop_count    = 0;
static unsigned long g_max_loop_time = 0;
static unsigned long g_loop_start    = 0;

// ---- Forward declarations ----
void check_alerts();
void update_status_led();
void setup_ota();
void print_banner();
void enter_deep_sleep();
void restore_actuator_states();
void save_actuator_states();
void check_scheduled_timers();
void execute_timer_action(const ScheduledTimer& timer);
void check_heap_health();
void send_diagnostic_report();
void handle_boot_reason();
void setup_safe_mode();
String get_reset_reason_string();

// ============================================================
// SETUP
// ============================================================
void setup() {
    // Serial init
    Serial.begin(115200);
    delay(500);
    print_banner();

    // Initialize EEPROM/NVS manager FIRST (before other modules)
    eeprom_init();

    // Record boot & detect crashes
    eeprom_increment_boot_count();
    handle_boot_reason();

    // Load user preferences from EEPROM
    eeprom_load_preferences(g_user_prefs);

    // Initialize utilities (NTP, watchdog)
    utils_init();
    log_set_level((LogLevel)g_user_prefs.log_level);

    LOG_I("MAIN", "Starting Nexus Home ESP32 Firmware v%d.%d.%d",
          FW_VERSION_MAJOR, FW_VERSION_MINOR, FW_VERSION_PATCH);
    LOG_I("MAIN", "Device ID: %s | Boot #%u", DEVICE_ID, eeprom_get_boot_count());
    LOG_I("MAIN", "Reset reason: %s", get_reset_reason_string().c_str());
    LOG_I("MAIN", "Free heap: %u bytes", get_free_heap());

    // Check for safe mode
    BootInfo boot_info;
    eeprom_load_boot_info(boot_info);
    if (boot_info.safe_mode) {
        g_safe_mode = true;
        LOG_E("MAIN", "*** SAFE MODE ACTIVE — minimal initialization ***");
        setup_safe_mode();
        return;
    }

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
    if (g_user_prefs.buzzer_enabled) {
        buzzer_beep(1000, 100);
    }

    // ---- Restore last device states from EEPROM ----
    if (g_user_prefs.auto_restore_state) {
        LOG_I("MAIN", "Restoring device states from EEPROM...");
        restore_actuator_states();
    }

    // Load scheduled timers from EEPROM
    g_timer_count = eeprom_load_timers(g_timers, MAX_SCHEDULED_TIMERS);
    LOG_I("MAIN", "Loaded %d scheduled timers", g_timer_count);

    // Initialize WiFi
    LOG_I("MAIN", "Initializing WiFi...");
    wifi_init();

    if (wifi_is_connected()) {
        neopixel_set_color(0, 255, 0);  // Green = connected
        if (g_user_prefs.buzzer_enabled) buzzer_success();

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
    LOG_I("MAIN", "========================================");
    LOG_I("MAIN", "  System Ready! (Boot #%u)", eeprom_get_boot_count());
    LOG_I("MAIN", "  Free heap: %u bytes", get_free_heap());
    LOG_I("MAIN", "  NVS writes: %u lifetime", eeprom_get_write_count());
    LOG_I("MAIN", "========================================");

    // Breathe green to indicate ready
    neopixel_animation_breathing(0, 255, 0);

    // Clear safe mode flag since we booted successfully
    if (boot_info.crash_count > 0) {
        boot_info.crash_count = 0;
        boot_info.safe_mode = false;
        eeprom_save_boot_info(boot_info);
        LOG_I("MAIN", "Cleared crash counter — clean boot");
    }
}

// ============================================================
// LOOP
// ============================================================
void loop() {
    unsigned long now = millis();
    g_loop_start = now;
    g_loop_count++;

    // ---- Safe mode: minimal loop ----
    if (g_safe_mode) {
        utils_loop();
        wifi_loop();
        webserver_loop();
        ArduinoOTA.handle();
        eeprom_loop();

        // Exit safe mode after timeout
        if (get_uptime_seconds() > EEPROM_SAFE_MODE_DURATION) {
            LOG_I("MAIN", "Safe mode timeout reached, rebooting normally...");
            BootInfo bi;
            eeprom_load_boot_info(bi);
            bi.safe_mode = false;
            bi.crash_count = 0;
            eeprom_save_boot_info(bi);
            delay(500);
            ESP.restart();
        }
        delay(100);
        return;
    }

    // ---- Core module loops ----
    utils_loop();         // Watchdog feed, NTP update
    wifi_loop();          // WiFi reconnect
    mqtt_loop();          // MQTT reconnect + periodic publish
    sensors_loop();       // Read all sensors
    actuators_loop();     // Animations, dimming, buzzer patterns
    power_loop();         // Power measurement + accumulation
    webserver_loop();     // WebSocket broadcasts
    eeprom_loop();        // Deferred NVS saves

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

    // ---- Scheduled timer check ----
    if (now - g_last_timer_check >= TIMER_CHECK_INTERVAL) {
        g_last_timer_check = now;
        check_scheduled_timers();
    }

    // ---- Heap health monitoring (every 30 seconds) ----
    if (now - g_last_heap_report >= 30000) {
        g_last_heap_report = now;
        check_heap_health();
    }

    // ---- Diagnostic report ----
    if (now - g_last_diag_report >= DIAG_REPORT_INTERVAL) {
        g_last_diag_report = now;
        send_diagnostic_report();
    }

    // ---- Auto-save device states periodically ----
    if (now - g_last_auto_save >= EEPROM_AUTO_SAVE_INTERVAL_MS) {
        g_last_auto_save = now;
        save_actuator_states();
        power_save_data();
        LOG_D("MAIN", "Auto-saved device states & power data");
    }

    // ---- Save uptime every hour (for lifetime tracking) ----
    if (now - g_last_uptime_save >= 3600000UL) {
        g_last_uptime_save = now;
        BootInfo bi;
        eeprom_load_boot_info(bi);
        bi.last_uptime_sec = get_uptime_seconds();
        bi.total_uptime_hours++;
        eeprom_save_boot_info(bi);
    }

    // ---- Deep sleep check ----
    if (g_user_prefs.deep_sleep_enabled) {
        if (get_uptime_seconds() > DEEP_SLEEP_NO_CONN_TIMEOUT &&
            !mqtt_is_connected() && !wifi_is_connected()) {
            LOG_I("MAIN", "No connectivity for %ds, entering deep sleep for %d seconds",
                  DEEP_SLEEP_NO_CONN_TIMEOUT, g_user_prefs.deep_sleep_duration);
            enter_deep_sleep();
        }
    }

    // ---- Track max loop time ----
    unsigned long loop_dur = millis() - g_loop_start;
    if (loop_dur > g_max_loop_time) {
        g_max_loop_time = loop_dur;
        if (loop_dur > 500) {
            LOG_W("MAIN", "Slow loop detected: %lu ms", loop_dur);
        }
    }

    // Small yield to prevent WDT on tight loops
    yield();
}

// ============================================================
// Boot Reason Handling
// ============================================================
void handle_boot_reason() {
    esp_reset_reason_t reason = esp_reset_reason();

    switch (reason) {
        case ESP_RST_POWERON:
            LOG_I("BOOT", "Power-on reset — fresh start");
            break;
        case ESP_RST_SW:
            LOG_I("BOOT", "Software reset (OTA or user-triggered)");
            break;
        case ESP_RST_PANIC:
            LOG_E("BOOT", "*** PANIC/CRASH reset — check logs ***");
            eeprom_save_last_error("Panic/exception crash");
            break;
        case ESP_RST_INT_WDT:
            LOG_E("BOOT", "*** Interrupt watchdog reset ***");
            eeprom_save_last_error("Interrupt WDT timeout");
            break;
        case ESP_RST_TASK_WDT:
            LOG_E("BOOT", "*** Task watchdog reset ***");
            eeprom_save_last_error("Task WDT timeout");
            break;
        case ESP_RST_WDT:
            LOG_W("BOOT", "Watchdog reset");
            eeprom_save_last_error("WDT reset");
            break;
        case ESP_RST_DEEPSLEEP:
            LOG_I("BOOT", "Wakeup from deep sleep");
            break;
        case ESP_RST_BROWNOUT:
            LOG_W("BOOT", "Brownout reset — check power supply!");
            eeprom_save_last_error("Brownout - power issue");
            break;
        case ESP_RST_SDIO:
            LOG_I("BOOT", "SDIO reset");
            break;
        default:
            LOG_I("BOOT", "Unknown reset reason: %d", (int)reason);
            break;
    }
}

String get_reset_reason_string() {
    esp_reset_reason_t reason = esp_reset_reason();
    switch (reason) {
        case ESP_RST_POWERON:   return "PowerOn";
        case ESP_RST_SW:        return "Software";
        case ESP_RST_PANIC:     return "Panic/Crash";
        case ESP_RST_INT_WDT:   return "IntWDT";
        case ESP_RST_TASK_WDT:  return "TaskWDT";
        case ESP_RST_WDT:       return "WDT";
        case ESP_RST_DEEPSLEEP: return "DeepSleep";
        case ESP_RST_BROWNOUT:  return "Brownout";
        default:                return "Unknown";
    }
}

// ============================================================
// Safe Mode Setup (minimal init after repeated crashes)
// ============================================================
void setup_safe_mode() {
    utils_init();
    wifi_init();
    webserver_init();
    setup_ota();

    neopixel_set_color(255, 0, 255);  // Purple = safe mode

    g_system_ready = true;
    LOG_E("MAIN", "Safe mode active. Access http://%s/config to reconfigure.",
          wifi_is_connected() ? wifi_get_ip().c_str() : wifi_get_ap_ip().c_str());
    LOG_E("MAIN", "Factory reset available at /api/factory-reset");
}

// ============================================================
// EEPROM State Restore (on boot)
// ============================================================
void restore_actuator_states() {
    ActuatorSnapshot snapshot;
    if (!eeprom_load_actuator_state(snapshot)) {
        LOG_I("MAIN", "No saved state to restore — using defaults");
        return;
    }

    // Restore lights
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (snapshot.lights[i].on) {
            light_set(i, true);
            light_set_brightness(i, snapshot.lights[i].brightness);
            LOG_I("MAIN", "  Restored Light %d: ON (brightness=%d)", i + 1, snapshot.lights[i].brightness);
        }
    }

    // Restore fan
    if (snapshot.fan.on) {
        fan_set(true);
        fan_set_speed(snapshot.fan.speed);
        LOG_I("MAIN", "  Restored Fan: ON (speed=%d%%)", snapshot.fan.speed);
    }

    // Restore AC state (tracked internally, IR not re-sent)
    LOG_I("MAIN", "  Restored AC state: %s, %d°C, mode=%s",
          snapshot.ac.on ? "ON" : "OFF", snapshot.ac.temperature, snapshot.ac.mode);

    // Restore NeoPixel brightness
    neopixel_set_brightness(snapshot.neo_brightness);

    // Restore active scene (if not NONE)
    if (snapshot.active_scene != 0) {
        scene_activate((Scene)snapshot.active_scene);
        LOG_I("MAIN", "  Restored scene: %d", snapshot.active_scene);
    }

    LOG_I("MAIN", "Device states restored from EEPROM successfully");
}

// ============================================================
// EEPROM State Save (periodic + on change)
// ============================================================
void save_actuator_states() {
    ActuatorSnapshot snapshot;

    for (int i = 0; i < MAX_LIGHTS; i++) {
        snapshot.lights[i].on         = light_get_state(i);
        snapshot.lights[i].brightness = light_get_brightness(i);
    }

    snapshot.fan.on    = fan_get_state();
    snapshot.fan.speed = fan_get_speed();

    snapshot.ac.on          = ac_get_state();
    snapshot.ac.temperature = (int8_t)ac_get_set_temp();
    strncpy(snapshot.ac.mode, ac_get_mode().c_str(), sizeof(snapshot.ac.mode) - 1);
    snapshot.ac.mode[sizeof(snapshot.ac.mode) - 1] = '\0';
    strncpy(snapshot.ac.fan_speed, "auto", sizeof(snapshot.ac.fan_speed) - 1);

    snapshot.neo_brightness = NEOPIXEL_BRIGHTNESS;
    snapshot.active_scene   = 0;

    eeprom_save_actuator_state(snapshot);
}

// ============================================================
// Scheduled Timer Execution
// ============================================================
void check_scheduled_timers() {
    if (g_timer_count == 0) return;

    unsigned long epoch = get_epoch_time();
    if (epoch < 1000000) return;

    struct tm* now_tm = gmtime((time_t*)&epoch);
    int current_hour   = now_tm->tm_hour;
    int current_minute = now_tm->tm_min;
    int day_of_week    = now_tm->tm_wday;
    uint8_t day_bit = (day_of_week == 0) ? 0x40 : (1 << (day_of_week - 1));

    bool timers_modified = false;

    for (int i = 0; i < g_timer_count; i++) {
        if (!g_timers[i].active) continue;
        if (!(g_timers[i].days_mask & day_bit)) continue;

        if (g_timers[i].hour == current_hour && g_timers[i].minute == current_minute) {
            LOG_I("TIMER", "Executing timer %d: dev=%d ch=%d -> %s",
                  i, g_timers[i].device_type, g_timers[i].channel,
                  g_timers[i].target_state ? "ON" : "OFF");

            execute_timer_action(g_timers[i]);

            if (g_timers[i].one_shot) {
                g_timers[i].active = false;
                timers_modified = true;
                LOG_I("TIMER", "One-shot timer %d deactivated", i);
            }
        }
    }

    if (timers_modified) {
        eeprom_save_timers(g_timers, g_timer_count);
    }
}

void execute_timer_action(const ScheduledTimer& timer) {
    switch (timer.device_type) {
        case 0: // Light
            light_set(timer.channel, timer.target_state);
            mqtt_publish_device_state("light", timer.channel + 1,
                timer.target_state ? "ON" : "OFF");
            break;
        case 1: // Fan
            fan_set(timer.target_state);
            mqtt_publish_device_state("fan", 0, timer.target_state ? "ON" : "OFF");
            break;
        case 2: // AC
            if (timer.target_state != ac_get_state()) {
                ac_power_toggle();
            }
            break;
        case 3: // Scene
            scene_activate((Scene)timer.channel);
            break;
        default:
            LOG_W("TIMER", "Unknown device type: %d", timer.device_type);
            break;
    }

    if (EEPROM_SAVE_ON_CHANGE) {
        eeprom_mark_state_dirty();
    }
}

// ============================================================
// Alert Checking — Enhanced with cooldown & preferences
// ============================================================
void check_alerts() {
    SensorData sd = sensors_get_data();
    PowerData pd  = power_get_data();
    unsigned long now = millis();

    // ---- Gas Leak ----
    if (g_user_prefs.gas_alerts_enabled) {
        if (sd.gas_leak_detected && !g_alert_gas_sent) {
            g_alert_gas_sent = true;
            if (g_user_prefs.buzzer_enabled) buzzer_alert_gas();
            neopixel_animation_alert();
            mqtt_publish_alert("gas_leak", "Gas leak detected! Immediate attention required.", 3);
            LOG_E("ALERT", "*** GAS LEAK DETECTED ***");
            g_last_alert_time = now;
        } else if (!sd.gas_leak_detected && g_alert_gas_sent) {
            g_alert_gas_sent = false;
            buzzer_stop();
            mqtt_publish_alert("gas_leak_cleared", "Gas levels returned to normal.", 1);
            LOG_I("ALERT", "Gas leak cleared");
        }
    }

    // ---- Water Level Low ----
    if (g_user_prefs.water_alerts_enabled) {
        if (sd.water_level_pct < WATER_LEVEL_LOW && sd.water_level_pct > 0 && !g_alert_water_sent) {
            if (now - g_last_alert_time >= ALERT_COOLDOWN_MS) {
                g_alert_water_sent = true;
                if (g_user_prefs.buzzer_enabled) buzzer_alert_water();

                const char* severity_msg = (sd.water_level_pct < WATER_LEVEL_CRITICAL)
                    ? "Water tank CRITICALLY low!" : "Water tank level low!";
                int severity = (sd.water_level_pct < WATER_LEVEL_CRITICAL) ? 3 : 2;

                mqtt_publish_alert("water_low", severity_msg, severity);
                LOG_W("ALERT", "Water level low: %.1f%%", sd.water_level_pct);
                g_last_alert_time = now;
            }
        } else if (sd.water_level_pct >= WATER_LEVEL_LOW + 5 && g_alert_water_sent) {
            g_alert_water_sent = false;
            buzzer_stop();
            LOG_I("ALERT", "Water level recovered: %.1f%%", sd.water_level_pct);
        }
    }

    // ---- Temperature High ----
    if (sd.temperature > TEMP_HIGH_THRESHOLD && !g_alert_temp_hi_sent) {
        if (now - g_last_alert_time >= ALERT_COOLDOWN_MS) {
            g_alert_temp_hi_sent = true;
            mqtt_publish_alert("temp_high", "High temperature alert!", 2);
            LOG_W("ALERT", "Temperature high: %.1f°C", sd.temperature);
            g_last_alert_time = now;
        }
    } else if (sd.temperature < TEMP_HIGH_THRESHOLD - 2 && g_alert_temp_hi_sent) {
        g_alert_temp_hi_sent = false;
    }

    // ---- Temperature Low ----
    if (sd.temperature < TEMP_LOW_THRESHOLD && sd.temperature > -40 && !g_alert_temp_lo_sent) {
        if (now - g_last_alert_time >= ALERT_COOLDOWN_MS) {
            g_alert_temp_lo_sent = true;
            mqtt_publish_alert("temp_low", "Low temperature alert!", 2);
            LOG_W("ALERT", "Temperature low: %.1f°C", sd.temperature);
            g_last_alert_time = now;
        }
    } else if (sd.temperature > TEMP_LOW_THRESHOLD + 2 && g_alert_temp_lo_sent) {
        g_alert_temp_lo_sent = false;
    }

    // ---- Humidity High ----
    if (sd.humidity > HUMIDITY_HIGH && !g_alert_humidity_sent) {
        if (now - g_last_alert_time >= ALERT_COOLDOWN_MS) {
            g_alert_humidity_sent = true;
            mqtt_publish_alert("humidity_high", "High humidity alert!", 2);
            LOG_W("ALERT", "Humidity high: %.1f%%", sd.humidity);
            g_last_alert_time = now;
        }
    } else if (sd.humidity < HUMIDITY_HIGH - 5 && g_alert_humidity_sent) {
        g_alert_humidity_sent = false;
    }

    // ---- Motion (in away mode) ----
    if (g_user_prefs.motion_alerts_enabled) {
        if (sd.motion_detected && scene_get_active() == "away") {
            if (now - g_last_alert_time >= ALERT_COOLDOWN_MS) {
                if (g_user_prefs.buzzer_enabled) buzzer_alert_motion();
                mqtt_publish_alert("motion_intrusion", "Motion detected in AWAY mode!", 3);
                LOG_W("ALERT", "Intrusion: motion in away mode!");
                g_last_alert_time = now;
            }
        }
    }

    // ---- Power Anomaly ----
    if (g_user_prefs.power_alerts_enabled) {
        if (pd.anomaly_detected && !g_alert_power_sent) {
            if (now - g_last_alert_time >= ALERT_COOLDOWN_MS) {
                g_alert_power_sent = true;
                mqtt_publish_alert("power_spike", "Abnormal power consumption detected!", 2);
                LOG_W("ALERT", "Power anomaly: %.1fW", pd.power_watts);
                g_last_alert_time = now;
            }
        } else if (!pd.anomaly_detected && g_alert_power_sent) {
            g_alert_power_sent = false;
        }
    }
}

// ============================================================
// Heap Health Monitoring
// ============================================================
void check_heap_health() {
    uint32_t free_heap = get_free_heap();
    uint32_t min_free  = ESP.getMinFreeHeap();

    if (free_heap < g_min_heap_seen) {
        g_min_heap_seen = free_heap;
    }

    LOG_D("MAIN", "Heap: %u free | %u min | Loops: %u | MaxLoop: %lu ms | Uptime: %s | MQTT TX:%u RX:%u",
          free_heap, min_free, g_loop_count, g_max_loop_time,
          get_uptime_string().c_str(),
          mqtt_get_messages_sent(), mqtt_get_messages_received());

    if (free_heap < HEAP_WARNING_THRESHOLD && !g_alert_heap_sent) {
        g_alert_heap_sent = true;
        LOG_W("MAIN", "*** LOW HEAP WARNING: %u bytes remaining ***", free_heap);
        mqtt_publish_alert("low_heap", "ESP32 running low on memory!", 2);
    } else if (free_heap > HEAP_WARNING_THRESHOLD + 5000) {
        g_alert_heap_sent = false;
    }

    if (free_heap < HEAP_CRITICAL_THRESHOLD) {
        LOG_E("MAIN", "*** CRITICAL HEAP: %u bytes — saving state and rebooting ***", free_heap);
        save_actuator_states();
        power_save_data();
        eeprom_save_last_error("Critical heap - forced reboot");
        delay(500);
        ESP.restart();
    }
}

// ============================================================
// Diagnostic Report (published via MQTT)
// ============================================================
void send_diagnostic_report() {
    if (!mqtt_is_connected()) return;

    JsonDocument doc;
    doc["device"]        = DEVICE_ID;
    doc["firmware"]      = String(FW_VERSION_MAJOR) + "." + String(FW_VERSION_MINOR) + "." + String(FW_VERSION_PATCH);
    doc["uptime"]        = get_uptime_string();
    doc["uptime_sec"]    = get_uptime_seconds();
    doc["free_heap"]     = get_free_heap();
    doc["min_heap"]      = ESP.getMinFreeHeap();
    doc["min_heap_seen"] = g_min_heap_seen;
    doc["loop_count"]    = g_loop_count;
    doc["max_loop_ms"]   = g_max_loop_time;
    doc["reset_reason"]  = get_reset_reason_string();
    doc["boot_count"]    = eeprom_get_boot_count();
    doc["wifi_rssi"]     = wifi_get_rssi();
    doc["wifi_quality"]  = wifi_signal_quality();
    doc["mqtt_sent"]     = mqtt_get_messages_sent();
    doc["mqtt_recv"]     = mqtt_get_messages_received();
    doc["nvs_writes"]    = eeprom_get_write_count();
    doc["nvs_free"]      = (unsigned)eeprom_get_free_entries();
    doc["active_timers"] = g_timer_count;
    doc["sensors_warmed"] = sensors_is_warmed_up();
    doc["timestamp"]     = get_timestamp();

    mqtt_publish_json(TOPIC_DIAGNOSTIC, doc, false);
    LOG_D("MAIN", "Diagnostic report published");
}

// ============================================================
// Status LED Update
// ============================================================
void update_status_led() {
    if (g_alert_gas_sent) return;
    if (scene_get_active() != "none") return;

    if (g_safe_mode) {
        neopixel_animation_breathing(255, 0, 255);  // Purple = safe mode
        return;
    }

    if (!wifi_is_connected()) {
        neopixel_animation_breathing(255, 165, 0);  // Orange = no WiFi
    } else if (!mqtt_is_connected()) {
        neopixel_animation_breathing(255, 255, 0);  // Yellow = no MQTT
    } else if (!sensors_is_warmed_up()) {
        neopixel_animation_breathing(0, 0, 255);    // Blue = warming up
    } else {
        neopixel_clear();
        neopixel_set_pixel(0, 0, 255, 0);  // WiFi
        neopixel_set_pixel(1, mqtt_is_connected() ? 0 : 255,
                              mqtt_is_connected() ? 255 : 0, 0);  // MQTT
        int aqi = sensor_read_air_quality_raw();
        if (aqi < 200) neopixel_set_pixel(2, 0, 255, 0);
        else if (aqi < 400) neopixel_set_pixel(2, 255, 165, 0);
        else neopixel_set_pixel(2, 255, 0, 0);

        uint32_t heap = get_free_heap();
        if (heap > HEAP_WARNING_THRESHOLD)
            neopixel_set_pixel(3, 0, 0, 255);
        else if (heap > HEAP_CRITICAL_THRESHOLD)
            neopixel_set_pixel(3, 255, 165, 0);
        else
            neopixel_set_pixel(3, 255, 0, 0);
    }
}

// ============================================================
// OTA Setup — saves state before update
// ============================================================
void setup_ota() {
    ArduinoOTA.setHostname(WIFI_HOSTNAME);
    ArduinoOTA.setPassword(OTA_PASSWORD);

    ArduinoOTA.onStart([]() {
        String type = (ArduinoOTA.getCommand() == U_FLASH) ? "firmware" : "filesystem";
        LOG_I("OTA", "Start updating %s — saving state...", type.c_str());
        save_actuator_states();
        power_save_data();
        neopixel_set_color(0, 0, 255);
        mqtt_publish_status("updating");
    });

    ArduinoOTA.onEnd([]() {
        LOG_I("OTA", "Update complete!");
        neopixel_set_color(0, 255, 0);
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        int pct = (progress / (total / 100));
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
        LOG_E("OTA", "Error[%u]", error);
        neopixel_set_color(255, 0, 0);
        if (g_user_prefs.buzzer_enabled) buzzer_error();
        eeprom_save_last_error("OTA error: " + String(error));
    });

    ArduinoOTA.begin();
    LOG_I("OTA", "OTA ready. Hostname: %s", WIFI_HOSTNAME);
}

// ============================================================
// Deep Sleep — saves full state before sleeping
// ============================================================
void enter_deep_sleep() {
    LOG_I("MAIN", "Preparing for deep sleep...");

    // Save all state
    save_actuator_states();
    power_save_data();

    BootInfo bi;
    eeprom_load_boot_info(bi);
    bi.last_uptime_sec = get_uptime_seconds();
    eeprom_save_boot_info(bi);

    mqtt_publish_status("sleeping");
    mqtt_disconnect();

    light_all_off();
    fan_set(false);
    neopixel_clear();
    buzzer_stop();

    LOG_I("MAIN", "Entering deep sleep for %d seconds", g_user_prefs.deep_sleep_duration);
    Serial.flush();

    esp_sleep_enable_timer_wakeup((uint64_t)g_user_prefs.deep_sleep_duration * 1000000ULL);
    esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_PIR, HIGH);

    esp_deep_sleep_start();
}

// ============================================================
// Startup Banner
// ============================================================
void print_banner() {
    Serial.println();
    Serial.println("╔═══════════════════════════════════════════════╗");
    Serial.println("║     NEXUS AI OS - Home Automation v2.0        ║");
    Serial.println("║     ESP32 Firmware with EEPROM Persistence    ║");
    Serial.println("║     (c) 2026 Nexus AI Systems                 ║");
    Serial.println("╚═══════════════════════════════════════════════╝");
    Serial.println();
    Serial.printf("  Chip:    %s Rev %d\n", ESP.getChipModel(), ESP.getChipRevision());
    Serial.printf("  Cores:   %d\n", ESP.getChipCores());
    Serial.printf("  Flash:   %dMB (%dMHz)\n",
                  ESP.getFlashChipSize() / 1024 / 1024,
                  ESP.getFlashChipSpeed() / 1000000);
    Serial.printf("  PSRAM:   %s", ESP.getPsramSize() > 0 ? "Yes" : "No");
    if (ESP.getPsramSize() > 0) Serial.printf(" (%d KB)", ESP.getPsramSize() / 1024);
    Serial.println();
    Serial.printf("  Heap:    %u bytes free\n", ESP.getFreeHeap());
    Serial.printf("  SDK:     %s\n", ESP.getSdkVersion());
    Serial.printf("  MAC:     %s\n", WiFi.macAddress().c_str());
    Serial.printf("  Reset:   %s\n", get_reset_reason_string().c_str());
    Serial.println();
}
