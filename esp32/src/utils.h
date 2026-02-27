#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Utilities Header
// ============================================================

#ifndef UTILS_H
#define UTILS_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <esp_task_wdt.h>

// Log levels
enum LogLevel {
    LOG_DEBUG = 0,
    LOG_INFO  = 1,
    LOG_WARN  = 2,
    LOG_ERROR = 3,
    LOG_NONE  = 4
};

void utils_init();
void utils_loop();

// Logging
void log_set_level(LogLevel level);
void log_msg(LogLevel level, const char* tag, const char* fmt, ...);
#define LOG_D(tag, fmt, ...) log_msg(LOG_DEBUG, tag, fmt, ##__VA_ARGS__)
#define LOG_I(tag, fmt, ...) log_msg(LOG_INFO,  tag, fmt, ##__VA_ARGS__)
#define LOG_W(tag, fmt, ...) log_msg(LOG_WARN,  tag, fmt, ##__VA_ARGS__)
#define LOG_E(tag, fmt, ...) log_msg(LOG_ERROR, tag, fmt, ##__VA_ARGS__)

// Time
void     ntp_init();
void     ntp_update();
String   get_timestamp();
String   get_date_string();
unsigned long get_epoch_time();

// Preferences storage
void     prefs_init();
void     prefs_save_string(const char* key, const String& value);
String   prefs_get_string(const char* key, const String& defaultVal = "");
void     prefs_save_float(const char* key, float value);
float    prefs_get_float(const char* key, float defaultVal = 0.0f);
void     prefs_save_int(const char* key, int32_t value);
int32_t  prefs_get_int(const char* key, int32_t defaultVal = 0);
void     prefs_save_bool(const char* key, bool value);
bool     prefs_get_bool(const char* key, bool defaultVal = false);

// Watchdog
void     watchdog_init(uint32_t timeout_sec = 30);
void     watchdog_feed();

// System info
uint32_t get_free_heap();
String   get_uptime_string();
unsigned long get_uptime_seconds();
String   get_mac_address();
String   get_ip_address();
String   format_bytes(size_t bytes);

// String helpers
String   json_escape(const String& input);
String   float_to_string(float val, int decimals = 2);

#endif // UTILS_H
