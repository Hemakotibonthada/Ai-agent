#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// WiFi Manager Header
// ============================================================

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>

enum WiFiState {
    WIFI_STATE_DISCONNECTED,
    WIFI_STATE_CONNECTING,
    WIFI_STATE_CONNECTED,
    WIFI_STATE_AP_MODE,
    WIFI_STATE_SCANNING
};

void       wifi_init();
void       wifi_loop();
bool       wifi_connect(const String& ssid, const String& password, uint32_t timeout_ms = 15000);
void       wifi_disconnect();
void       wifi_start_ap();
void       wifi_stop_ap();
bool       wifi_is_connected();
WiFiState  wifi_get_state();
int        wifi_get_rssi();
String     wifi_get_ssid();
String     wifi_get_ip();
String     wifi_get_mac();
String     wifi_get_ap_ip();
String     wifi_scan_networks_json();
void       wifi_set_credentials(const String& ssid, const String& password);
void       wifi_save_credentials();
void       wifi_load_credentials();
int        wifi_signal_quality();  // 0-100%

#endif // WIFI_MANAGER_H
