// ============================================================
// Nexus AI OS - ESP32 Home Automation
// WiFi Manager Implementation
// ============================================================

#include "wifi_manager.h"
#include "config.h"
#include "utils.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include <DNSServer.h>

// ---- State ----
static WiFiState  g_wifi_state = WIFI_STATE_DISCONNECTED;
static String     g_ssid       = WIFI_SSID_DEFAULT;
static String     g_password   = WIFI_PASS_DEFAULT;
static uint8_t    g_retries    = 0;
static unsigned long g_last_reconnect_attempt = 0;
static bool       g_ap_active  = false;
static DNSServer  g_dns_server;
static const byte DNS_PORT = 53;

// ---- WiFi event handler ----
static void wifi_event_handler(WiFiEvent_t event) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            LOG_I("WIFI", "Connected! IP: %s", WiFi.localIP().toString().c_str());
            g_wifi_state = WIFI_STATE_CONNECTED;
            g_retries = 0;
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            if (g_wifi_state == WIFI_STATE_CONNECTED) {
                LOG_W("WIFI", "Disconnected from WiFi");
            }
            g_wifi_state = WIFI_STATE_DISCONNECTED;
            break;
        case ARDUINO_EVENT_WIFI_AP_STACONNECTED:
            LOG_I("WIFI", "Client connected to AP");
            break;
        case ARDUINO_EVENT_WIFI_AP_STADISCONNECTED:
            LOG_I("WIFI", "Client disconnected from AP");
            break;
        default:
            break;
    }
}

// ============================================================
// Init
// ============================================================
void wifi_init() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.onEvent(wifi_event_handler);

    // Load saved credentials
    wifi_load_credentials();

    LOG_I("WIFI", "WiFi Manager initialized. MAC: %s", WiFi.macAddress().c_str());
    LOG_I("WIFI", "Connecting to: %s", g_ssid.c_str());

    // Attempt connection
    if (!wifi_connect(g_ssid, g_password, WIFI_CONNECT_TIMEOUT_MS)) {
        LOG_W("WIFI", "Initial connection failed, starting AP mode");
        wifi_start_ap();
    }
}

// ============================================================
// Loop
// ============================================================
void wifi_loop() {
    // Handle DNS for captive portal in AP mode
    if (g_ap_active) {
        g_dns_server.processNextRequest();
    }

    // Auto-reconnect in STA mode
    if (g_wifi_state == WIFI_STATE_DISCONNECTED && !g_ap_active) {
        unsigned long now = millis();
        if (now - g_last_reconnect_attempt >= WIFI_RECONNECT_INTERVAL) {
            g_last_reconnect_attempt = now;
            g_retries++;
            LOG_I("WIFI", "Reconnect attempt %d/%d", g_retries, WIFI_MAX_RETRIES);

            if (g_retries > WIFI_MAX_RETRIES) {
                LOG_W("WIFI", "Max retries reached, starting AP mode");
                wifi_start_ap();
                g_retries = 0;
            } else {
                wifi_connect(g_ssid, g_password, WIFI_CONNECT_TIMEOUT_MS);
            }
        }
    }
}

// ============================================================
// Connect
// ============================================================
bool wifi_connect(const String& ssid, const String& password, uint32_t timeout_ms) {
    g_wifi_state = WIFI_STATE_CONNECTING;

    // Stop AP if running
    if (g_ap_active) {
        wifi_stop_ap();
    }

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());

    LOG_I("WIFI", "Connecting to '%s'...", ssid.c_str());

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout_ms) {
        delay(250);
        Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        g_wifi_state = WIFI_STATE_CONNECTED;
        LOG_I("WIFI", "Connected! IP: %s, RSSI: %d dBm", WiFi.localIP().toString().c_str(), WiFi.RSSI());

        // Start mDNS
        if (MDNS.begin("nexus-home")) {
            MDNS.addService("http", "tcp", WEB_PORT);
            MDNS.addService("mqtt", "tcp", MQTT_PORT_DEFAULT);
            LOG_I("WIFI", "mDNS started: nexus-home.local");
        }
        return true;
    }

    g_wifi_state = WIFI_STATE_DISCONNECTED;
    LOG_W("WIFI", "Connection failed (timeout)");
    return false;
}

void wifi_disconnect() {
    WiFi.disconnect(true);
    g_wifi_state = WIFI_STATE_DISCONNECTED;
    LOG_I("WIFI", "Disconnected");
}

// ============================================================
// AP Mode (Captive Portal)
// ============================================================
void wifi_start_ap() {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS);

    // Start DNS for captive portal - redirect all to AP IP
    g_dns_server.start(DNS_PORT, "*", WiFi.softAPIP());
    g_ap_active = true;
    g_wifi_state = WIFI_STATE_AP_MODE;

    LOG_I("WIFI", "AP started: SSID='%s', IP=%s", WIFI_AP_SSID, WiFi.softAPIP().toString().c_str());
}

void wifi_stop_ap() {
    g_dns_server.stop();
    WiFi.softAPdisconnect(true);
    g_ap_active = false;
    LOG_I("WIFI", "AP stopped");
}

// ============================================================
// Getters
// ============================================================
bool wifi_is_connected() {
    return WiFi.status() == WL_CONNECTED;
}

WiFiState wifi_get_state() {
    return g_wifi_state;
}

int wifi_get_rssi() {
    return WiFi.RSSI();
}

String wifi_get_ssid() {
    return WiFi.SSID();
}

String wifi_get_ip() {
    return WiFi.localIP().toString();
}

String wifi_get_mac() {
    return WiFi.macAddress();
}

String wifi_get_ap_ip() {
    return WiFi.softAPIP().toString();
}

int wifi_signal_quality() {
    int rssi = WiFi.RSSI();
    // Convert RSSI to quality percentage
    if (rssi <= -100) return 0;
    if (rssi >= -50) return 100;
    return 2 * (rssi + 100);
}

// ============================================================
// WiFi Scan
// ============================================================
String wifi_scan_networks_json() {
    g_wifi_state = WIFI_STATE_SCANNING;
    int n = WiFi.scanNetworks();
    g_wifi_state = wifi_is_connected() ? WIFI_STATE_CONNECTED : WIFI_STATE_DISCONNECTED;

    JsonDocument doc;
    JsonArray networks = doc["networks"].to<JsonArray>();

    for (int i = 0; i < n; i++) {
        JsonObject net = networks.add<JsonObject>();
        net["ssid"]    = WiFi.SSID(i);
        net["rssi"]    = WiFi.RSSI(i);
        net["channel"] = WiFi.channel(i);
        net["secure"]  = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    }
    doc["count"] = n;

    String output;
    serializeJson(doc, output);
    WiFi.scanDelete();
    return output;
}

// ============================================================
// Credentials Persistence
// ============================================================
void wifi_set_credentials(const String& ssid, const String& password) {
    g_ssid = ssid;
    g_password = password;
}

void wifi_save_credentials() {
    prefs_save_string("wifi_ssid", g_ssid);
    prefs_save_string("wifi_pass", g_password);
    LOG_I("WIFI", "Credentials saved");
}

void wifi_load_credentials() {
    String saved_ssid = prefs_get_string("wifi_ssid", "");
    String saved_pass = prefs_get_string("wifi_pass", "");
    if (saved_ssid.length() > 0) {
        g_ssid = saved_ssid;
        g_password = saved_pass;
        LOG_I("WIFI", "Loaded saved credentials for: %s", g_ssid.c_str());
    }
}
