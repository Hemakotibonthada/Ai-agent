// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Utilities Implementation
// ============================================================

#include "utils.h"
#include "config.h"
#include <WiFi.h>
#include <time.h>

// ---- Globals ----
static LogLevel  g_log_level = LOG_DEBUG;
static Preferences g_prefs;
static WiFiUDP   g_ntp_udp;
static NTPClient g_ntp(g_ntp_udp, NTP_SERVER, NTP_OFFSET_SEC, NTP_UPDATE_INTERVAL);
static unsigned long g_boot_time = 0;
static char g_log_buf[512];

// ============================================================
// Init
// ============================================================
void utils_init() {
    prefs_init();
    ntp_init();
    g_boot_time = millis();
    watchdog_init(30);
    LOG_I("UTILS", "Utilities initialized. Free heap: %u bytes", get_free_heap());
}

void utils_loop() {
    ntp_update();
    watchdog_feed();
}

// ============================================================
// Logging
// ============================================================
void log_set_level(LogLevel level) {
    g_log_level = level;
}

void log_msg(LogLevel level, const char* tag, const char* fmt, ...) {
    if (level < g_log_level) return;

    const char* level_str;
    switch (level) {
        case LOG_DEBUG: level_str = "DBG"; break;
        case LOG_INFO:  level_str = "INF"; break;
        case LOG_WARN:  level_str = "WRN"; break;
        case LOG_ERROR: level_str = "ERR"; break;
        default:        level_str = "???"; break;
    }

    va_list args;
    va_start(args, fmt);
    vsnprintf(g_log_buf, sizeof(g_log_buf), fmt, args);
    va_end(args);

    unsigned long ms = millis();
    Serial.printf("[%lu][%s][%s] %s\n", ms, level_str, tag, g_log_buf);
}

// ============================================================
// NTP Time
// ============================================================
void ntp_init() {
    g_ntp.begin();
    g_ntp.setTimeOffset(NTP_OFFSET_SEC);
    g_ntp.forceUpdate();
    LOG_I("NTP", "NTP client initialized");
}

void ntp_update() {
    g_ntp.update();
}

String get_timestamp() {
    unsigned long epoch = g_ntp.getEpochTime();
    struct tm* ptm = gmtime((time_t*)&epoch);
    char buf[30];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday,
             ptm->tm_hour, ptm->tm_min, ptm->tm_sec);
    return String(buf);
}

String get_date_string() {
    unsigned long epoch = g_ntp.getEpochTime();
    struct tm* ptm = gmtime((time_t*)&epoch);
    char buf[12];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02d",
             ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday);
    return String(buf);
}

unsigned long get_epoch_time() {
    return g_ntp.getEpochTime();
}

// ============================================================
// Preferences (NVS Storage)
// ============================================================
void prefs_init() {
    g_prefs.begin("nexus", false);
    LOG_I("PREFS", "Preferences storage initialized");
}

void prefs_save_string(const char* key, const String& value) {
    g_prefs.putString(key, value);
}

String prefs_get_string(const char* key, const String& defaultVal) {
    return g_prefs.getString(key, defaultVal);
}

void prefs_save_float(const char* key, float value) {
    g_prefs.putFloat(key, value);
}

float prefs_get_float(const char* key, float defaultVal) {
    return g_prefs.getFloat(key, defaultVal);
}

void prefs_save_int(const char* key, int32_t value) {
    g_prefs.putInt(key, value);
}

int32_t prefs_get_int(const char* key, int32_t defaultVal) {
    return g_prefs.getInt(key, defaultVal);
}

void prefs_save_bool(const char* key, bool value) {
    g_prefs.putBool(key, value);
}

bool prefs_get_bool(const char* key, bool defaultVal) {
    return g_prefs.getBool(key, defaultVal);
}

// ============================================================
// Watchdog
// ============================================================
void watchdog_init(uint32_t timeout_sec) {
    esp_task_wdt_init(timeout_sec, true);
    esp_task_wdt_add(NULL);
    LOG_I("WDT", "Watchdog initialized with %u sec timeout", timeout_sec);
}

void watchdog_feed() {
    esp_task_wdt_reset();
}

// ============================================================
// System Info
// ============================================================
uint32_t get_free_heap() {
    return ESP.getFreeHeap();
}

String get_uptime_string() {
    unsigned long sec = get_uptime_seconds();
    unsigned long d = sec / 86400;
    unsigned long h = (sec % 86400) / 3600;
    unsigned long m = (sec % 3600) / 60;
    unsigned long s = sec % 60;
    char buf[32];
    snprintf(buf, sizeof(buf), "%lud %luh %lum %lus", d, h, m, s);
    return String(buf);
}

unsigned long get_uptime_seconds() {
    return (millis() - g_boot_time) / 1000;
}

String get_mac_address() {
    return WiFi.macAddress();
}

String get_ip_address() {
    return WiFi.localIP().toString();
}

String format_bytes(size_t bytes) {
    if (bytes < 1024) return String(bytes) + " B";
    else if (bytes < (1024 * 1024)) return float_to_string(bytes / 1024.0, 1) + " KB";
    else if (bytes < (1024 * 1024 * 1024)) return float_to_string(bytes / 1048576.0, 1) + " MB";
    return float_to_string(bytes / 1073741824.0, 2) + " GB";
}

// ============================================================
// String Helpers
// ============================================================
String json_escape(const String& input) {
    String output;
    output.reserve(input.length() + 10);
    for (unsigned int i = 0; i < input.length(); i++) {
        char c = input.charAt(i);
        switch (c) {
            case '"': output += "\\\""; break;
            case '\\': output += "\\\\"; break;
            case '\n': output += "\\n"; break;
            case '\r': output += "\\r"; break;
            case '\t': output += "\\t"; break;
            default:
                if (c < 0x20) {
                    char hex[8];
                    snprintf(hex, sizeof(hex), "\\u%04x", c);
                    output += hex;
                } else {
                    output += c;
                }
                break;
        }
    }
    return output;
}

String float_to_string(float val, int decimals) {
    char buf[20];
    dtostrf(val, 1, decimals, buf);
    return String(buf);
}
