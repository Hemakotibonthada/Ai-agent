#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// EEPROM / NVS State Persistence Manager
// ============================================================
//
// Provides persistent storage for ALL device states using
// ESP32's Non-Volatile Storage (NVS / Preferences).
// On power loss, the device restores its last known state.
//
// Stored data:
//   - Actuator states (lights, fan, AC, buzzer)
//   - Active scene
//   - Sensor calibration values
//   - Power meter accumulators (kWh, cost)
//   - WiFi & MQTT credentials
//   - Boot counter & crash info
//   - Alert history
//   - Scheduled timers
//   - User preferences (NeoPixel brightness, log level, etc.)
//
// Data integrity: Magic byte + version + CRC32
// ============================================================

#ifndef EEPROM_MANAGER_H
#define EEPROM_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ---- Storage version (bump on struct changes) ----
#define EEPROM_MAGIC          0x4E45  // 'NE' for Nexus (ASCII N=0x4E, E=0x45)
#define EEPROM_VERSION        2
#define EEPROM_NAMESPACE      "nexus"
#define EEPROM_NS_STATE       "nxstate"
#define EEPROM_NS_CALIB       "nxcalib"
#define EEPROM_NS_BOOT        "nxboot"
#define EEPROM_NS_TIMERS      "nxtimers"
#define EEPROM_NS_USER        "nxuser"

// ---- Maximum values ----
#define MAX_LIGHTS            4
#define MAX_TIMERS            8
#define MAX_CRASH_LOGS        5
#define MAX_SAVED_SCENES      4

// ---- Debounce: don't save more often than this (ms) ----
#define EEPROM_SAVE_DEBOUNCE_MS  2000

// ============================================================
// Persisted Data Structures
// ============================================================

// Light state (per channel)
struct LightState {
    bool     on;
    uint8_t  brightness;     // 0-255
};

// Fan state
struct FanState {
    bool     on;
    uint8_t  speed;          // 0-100 percent
};

// AC state
struct AcState {
    bool     on;
    int8_t   temperature;    // Celsius
    char     mode[8];        // "cool", "heat", "auto", "fan", "dry"
    char     fan_speed[8];   // "auto", "low", "mid", "high"
};

// Full actuator state snapshot
struct ActuatorSnapshot {
    LightState  lights[MAX_LIGHTS];
    FanState    fan;
    AcState     ac;
    uint8_t     neo_brightness;
    uint8_t     active_scene;    // enum Scene value
};

// Sensor calibration data
struct SensorCalibration {
    float    mq135_r0;
    float    mq2_threshold;
    float    sct013_factor;
    float    dht_temp_offset;
    float    dht_humidity_offset;
    float    water_tank_height;
};

// Power meter accumulators
struct PowerAccumulators {
    float    total_kwh;
    float    daily_kwh;
    float    monthly_kwh;
    float    peak_watts;
    float    calibration;
    float    voltage;
    float    tariff;
    int      last_day;
    int      last_month;
};

// Boot information
struct BootInfo {
    uint32_t boot_count;
    uint32_t crash_count;
    uint32_t watchdog_resets;
    uint32_t last_uptime_sec;        // Uptime before last reboot
    uint8_t  last_reset_reason;      // esp_reset_reason_t
    uint32_t total_uptime_hours;     // Lifetime uptime in hours
    bool     safe_mode;              // Enter safe mode if too many crashes
};

// Scheduled timer entry
struct ScheduledTimer {
    bool     active;
    uint8_t  device_type;     // 0=light, 1=fan, 2=ac, 3=scene
    uint8_t  channel;         // device channel (for lights)
    bool     target_state;    // ON or OFF
    uint8_t  hour;            // 0-23
    uint8_t  minute;          // 0-59
    uint8_t  days_mask;       // bit mask: Mon=0x01 .. Sun=0x40, 0x7F=daily
    bool     one_shot;        // Auto-delete after triggering
};

// User preferences
struct UserPreferences {
    uint8_t  log_level;              // LogLevel enum
    uint8_t  neo_brightness;
    bool     buzzer_enabled;
    bool     auto_night_mode;        // Auto-enable night scenes
    uint16_t mqtt_publish_interval;  // Override default interval
    uint16_t ws_broadcast_interval;
    bool     deep_sleep_enabled;
    uint16_t deep_sleep_duration;    // seconds
    bool     auto_restore_state;     // Restore actuator states on boot
    bool     motion_alerts_enabled;
    bool     gas_alerts_enabled;
    bool     water_alerts_enabled;
    bool     power_alerts_enabled;
};

// ============================================================
// Public API
// ============================================================

// Lifecycle
void        eeprom_init();
void        eeprom_loop();                   // Call in main loop for debounced saves

// ---- Actuator State Persistence ----
void        eeprom_save_actuator_state(const ActuatorSnapshot& state);
bool        eeprom_load_actuator_state(ActuatorSnapshot& state);
void        eeprom_mark_state_dirty();       // Mark for deferred save

// ---- Sensor Calibration ----
void        eeprom_save_calibration(const SensorCalibration& cal);
bool        eeprom_load_calibration(SensorCalibration& cal);

// ---- Power Accumulators ----
void        eeprom_save_power(const PowerAccumulators& pwr);
bool        eeprom_load_power(PowerAccumulators& pwr);

// ---- Boot Info ----
void        eeprom_save_boot_info(const BootInfo& info);
bool        eeprom_load_boot_info(BootInfo& info);
void        eeprom_increment_boot_count();
void        eeprom_record_crash();
uint32_t    eeprom_get_boot_count();

// ---- Scheduled Timers ----
void        eeprom_save_timers(const ScheduledTimer timers[], int count);
int         eeprom_load_timers(ScheduledTimer timers[], int max_count);
void        eeprom_add_timer(const ScheduledTimer& timer);
void        eeprom_remove_timer(int index);
ScheduledTimer eeprom_get_timer(int index);
void        eeprom_save_timer(int index, const ScheduledTimer& timer);

// ---- User Preferences ----
void        eeprom_save_preferences(const UserPreferences& prefs);
bool        eeprom_load_preferences(UserPreferences& prefs);
UserPreferences eeprom_get_defaults();

// ---- Factory Reset ----
void        eeprom_factory_reset();
void        eeprom_clear_namespace(const char* ns);

// ---- Diagnostics ----
String      eeprom_get_stats_json();         // NVS usage, free entries, etc.
size_t      eeprom_get_free_entries();
size_t      eeprom_get_used_entries();
uint32_t    eeprom_get_write_count();        // Approximate write cycles

// ---- Quick helpers for individual values ----
void        eeprom_save_scene(uint8_t scene);
uint8_t     eeprom_load_scene();
void        eeprom_save_last_error(const String& error);
String      eeprom_load_last_error();

// ---- CRC32 utility ----
uint32_t    eeprom_crc32(const uint8_t* data, size_t length);

#endif // EEPROM_MANAGER_H
