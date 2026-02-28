// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Utilities Implementation — Enhanced v2.0
// Ring buffer logger, heap monitoring, time helpers
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

// ---- Ring Buffer Logger (v2.0) ----
static LogEntry g_log_ring[LOG_RING_BUFFER_SIZE];
static int g_log_ring_head = 0;
static int g_log_ring_count = 0;

// ============================================================
// Init
// ============================================================
void utils_init() {
    prefs_init();
    ntp_init();
    g_boot_time = millis();
    watchdog_init(WDT_TIMEOUT_SEC);
    LOG_I("UTILS", "Utilities v2.0 initialized. Free heap: %u bytes (min: %u)",
          get_free_heap(), get_min_free_heap());
}

void utils_loop() {
    ntp_update();
    watchdog_feed();
}

// ============================================================
// Logging with Ring Buffer (v2.0)
// ============================================================
void log_set_level(LogLevel level) {
    g_log_level = level;
}

LogLevel log_get_level() {
    return g_log_level;
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

    // Store in ring buffer
    LogEntry& entry = g_log_ring[g_log_ring_head];
    entry.timestamp_ms = ms;
    entry.level = level;
    strncpy(entry.tag, tag, sizeof(entry.tag) - 1);
    entry.tag[sizeof(entry.tag) - 1] = '\0';
    strncpy(entry.message, g_log_buf, sizeof(entry.message) - 1);
    entry.message[sizeof(entry.message) - 1] = '\0';

    g_log_ring_head = (g_log_ring_head + 1) % LOG_RING_BUFFER_SIZE;
    if (g_log_ring_count < LOG_RING_BUFFER_SIZE) g_log_ring_count++;
}

// ============================================================
// Ring Buffer Log Access (v2.0)
// ============================================================
int log_get_count() {
    return g_log_ring_count;
}

LogEntry log_get_entry(int index) {
    LogEntry empty = {};
    if (index < 0 || index >= g_log_ring_count) return empty;
    int actual;
    if (g_log_ring_count < LOG_RING_BUFFER_SIZE) {
        actual = index;
    } else {
        actual = (g_log_ring_head + index) % LOG_RING_BUFFER_SIZE;
    }
    return g_log_ring[actual];
}

String log_get_recent_json(int count) {
    JsonDocument doc;
    JsonArray arr = doc["logs"].to<JsonArray>();

    int start = g_log_ring_count - count;
    if (start < 0) start = 0;

    const char* levels[] = { "DEBUG", "INFO", "WARN", "ERROR" };

    for (int i = start; i < g_log_ring_count; i++) {
        LogEntry e = log_get_entry(i);
        JsonObject o = arr.add<JsonObject>();
        o["ms"]    = e.timestamp_ms;
        o["level"] = levels[min((int)e.level, 3)];
        o["tag"]   = (const char*)e.tag;
        o["msg"]   = (const char*)e.message;
    }

    doc["total"] = g_log_ring_count;
    doc["capacity"] = LOG_RING_BUFFER_SIZE;

    String output;
    serializeJson(doc, output);
    return output;
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

int get_current_hour() {
    unsigned long epoch = g_ntp.getEpochTime();
    struct tm* ptm = gmtime((time_t*)&epoch);
    return ptm->tm_hour;
}

int get_current_minute() {
    unsigned long epoch = g_ntp.getEpochTime();
    struct tm* ptm = gmtime((time_t*)&epoch);
    return ptm->tm_min;
}

int get_day_of_week() {
    unsigned long epoch = g_ntp.getEpochTime();
    struct tm* ptm = gmtime((time_t*)&epoch);
    return ptm->tm_wday;  // 0=Sunday
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
// System Info (v2.0 — enhanced)
// ============================================================
uint32_t get_free_heap() {
    return ESP.getFreeHeap();
}

uint32_t get_min_free_heap() {
    return ESP.getMinFreeHeap();
}

float get_heap_fragmentation() {
    uint32_t free = ESP.getFreeHeap();
    uint32_t largest = ESP.getMaxAllocHeap();
    if (free == 0) return 100.0f;
    return (1.0f - ((float)largest / (float)free)) * 100.0f;
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

String get_system_info_json() {
    JsonDocument doc;
    doc["device_id"]       = DEVICE_ID;
    doc["firmware"]        = String(FW_VERSION_MAJOR) + "." + String(FW_VERSION_MINOR) + "." + String(FW_VERSION_PATCH);
    doc["chip_model"]      = ESP.getChipModel();
    doc["chip_revision"]   = ESP.getChipRevision();
    doc["cpu_freq_mhz"]    = ESP.getCpuFreqMHz();
    doc["flash_size"]      = ESP.getFlashChipSize();
    doc["heap_free"]       = get_free_heap();
    doc["heap_min"]        = get_min_free_heap();
    doc["heap_frag_pct"]   = serialized(float_to_string(get_heap_fragmentation(), 1));
    doc["uptime"]          = get_uptime_string();
    doc["uptime_seconds"]  = get_uptime_seconds();
    doc["mac"]             = get_mac_address();
    doc["ip"]              = get_ip_address();

    String output;
    serializeJson(doc, output);
    return output;
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
