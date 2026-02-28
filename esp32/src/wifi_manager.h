#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// WiFi Manager Header — Enhanced v2.0
// Multi-network, exponential backoff, connection statistics
// ============================================================

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include "config.h"

enum WiFiState {
    WIFI_STATE_DISCONNECTED,
    WIFI_STATE_CONNECTING,
    WIFI_STATE_CONNECTED,
    WIFI_STATE_AP_MODE,
    WIFI_STATE_SCANNING,
    WIFI_STATE_RECONNECTING
};

// Saved network entry (multi-network support)
struct SavedNetwork {
    char     ssid[33];
    char     password[65];
    int8_t   priority;       // Higher = preferred
    int8_t   last_rssi;      // Last known signal strength
    uint16_t connect_count;  // Successful connection count
    uint16_t fail_count;     // Failed connection count
    bool     enabled;
};

// Connection statistics
struct WiFiStats {
    uint32_t total_connects;
    uint32_t total_disconnects;
    uint32_t total_reconnects;
    uint32_t longest_session_sec;
    uint32_t current_session_start;
    uint32_t ap_clients_served;
    int8_t   best_rssi;
    int8_t   worst_rssi;
    float    avg_rssi;
};

// ---- Core functions ----
void       wifi_init();
void       wifi_loop();
bool       wifi_connect(const String& ssid, const String& password, uint32_t timeout_ms = 15000);
void       wifi_disconnect();
void       wifi_start_ap();
void       wifi_stop_ap();
bool       wifi_is_connected();
WiFiState  wifi_get_state();
String     wifi_get_state_string();
int        wifi_get_rssi();
String     wifi_get_ssid();
String     wifi_get_ip();
String     wifi_get_mac();
String     wifi_get_ap_ip();
int        wifi_signal_quality();      // 0-100%

// ---- Multi-network management ----
bool       wifi_add_network(const String& ssid, const String& password, int8_t priority = 0);
bool       wifi_remove_network(const String& ssid);
int        wifi_get_network_count();
bool       wifi_auto_connect_best();   // Scan & connect to best saved network
String     wifi_get_saved_networks_json();

// ---- Scanning ----
String     wifi_scan_networks_json();

// ---- Credentials (legacy compat) ----
void       wifi_set_credentials(const String& ssid, const String& password);
void       wifi_save_credentials();
void       wifi_load_credentials();

// ---- Statistics ----
WiFiStats  wifi_get_stats();
String     wifi_get_stats_json();
uint32_t   wifi_get_uptime();          // Current session uptime in seconds

// ---- Power management ----
void       wifi_set_power_save(bool enable);
void       wifi_set_tx_power(int8_t dbm);  // 2-20 dBm

#endif // WIFI_MANAGER_H
