// ============================================================
// Nexus AI OS - ESP32 Home Automation
// WiFi Manager Implementation — Enhanced v2.0
// Multi-network, exponential backoff, connection statistics
// ============================================================

#include "wifi_manager.h"
#include "config.h"
#include "utils.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include <DNSServer.h>
#include <Preferences.h>

// ---- State ----
static WiFiState      g_wifi_state = WIFI_STATE_DISCONNECTED;
static SavedNetwork   g_networks[WIFI_MAX_SAVED_NETWORKS];
static int            g_network_count = 0;
static int            g_active_network_idx = -1;
static uint8_t        g_retries = 0;
static unsigned long  g_last_reconnect_attempt = 0;
static unsigned long  g_backoff_interval = WIFI_BACKOFF_INITIAL_MS;
static bool           g_ap_active = false;
static DNSServer      g_dns_server;
static const byte     DNS_PORT = 53;

// ---- Statistics ----
static WiFiStats      g_stats = {};
static int8_t         g_rssi_samples[10];
static int            g_rssi_sample_idx = 0;
static int            g_rssi_sample_count = 0;
static unsigned long  g_last_rssi_sample = 0;

// ---- Legacy credentials ----
static String g_ssid     = WIFI_SSID_DEFAULT;
static String g_password = WIFI_PASS_DEFAULT;

// ---- NVS persistence ----
static Preferences g_wifi_prefs;
static const char* NVS_WIFI_NS = "nxwifi";

// ---- Forward declarations ----
static void wifi_event_handler(WiFiEvent_t event);
static void wifi_save_networks();
static void wifi_load_networks();
static void wifi_update_rssi_stats();
static int  wifi_find_network(const String& ssid);
static int  wifi_pick_best_network(int n_scan);

// ============================================================
// WiFi Event Handler
// ============================================================
static void wifi_event_handler(WiFiEvent_t event) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            LOG_I("WIFI", "Connected! IP: %s, RSSI: %d dBm",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
            g_wifi_state = WIFI_STATE_CONNECTED;
            g_retries = 0;
            g_backoff_interval = WIFI_BACKOFF_INITIAL_MS;
            g_stats.total_connects++;
            g_stats.current_session_start = millis() / 1000;

            // Update saved network stats
            if (g_active_network_idx >= 0 && g_active_network_idx < g_network_count) {
                g_networks[g_active_network_idx].connect_count++;
                g_networks[g_active_network_idx].last_rssi = WiFi.RSSI();
                wifi_save_networks();
            }
            break;

        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            if (g_wifi_state == WIFI_STATE_CONNECTED) {
                LOG_W("WIFI", "Disconnected from WiFi");
                g_stats.total_disconnects++;

                // Track session duration
                uint32_t session_dur = (millis() / 1000) - g_stats.current_session_start;
                if (session_dur > g_stats.longest_session_sec) {
                    g_stats.longest_session_sec = session_dur;
                }
            }
            g_wifi_state = WIFI_STATE_DISCONNECTED;
            break;

        case ARDUINO_EVENT_WIFI_AP_STACONNECTED:
            LOG_I("WIFI", "Client connected to AP (total: %d)", WiFi.softAPgetStationNum());
            g_stats.ap_clients_served++;
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

    // Set hostname
    WiFi.setHostname(WIFI_HOSTNAME);

    // Load saved networks
    wifi_load_networks();

    // Also load legacy credentials
    wifi_load_credentials();

    // If no saved networks, add the default one
    if (g_network_count == 0 && g_ssid.length() > 0) {
        wifi_add_network(g_ssid, g_password, 10);
    }

    LOG_I("WIFI", "WiFi Manager v2.0 initialized. MAC: %s", WiFi.macAddress().c_str());
    LOG_I("WIFI", "Saved networks: %d", g_network_count);

    // Try to auto-connect to best network
    if (!wifi_auto_connect_best()) {
        // Fallback: try the default
        LOG_I("WIFI", "Auto-connect failed, trying default: %s", g_ssid.c_str());
        if (!wifi_connect(g_ssid, g_password, WIFI_CONNECT_TIMEOUT_MS)) {
            LOG_W("WIFI", "Initial connection failed, starting AP mode");
            wifi_start_ap();
        }
    }

    // Initialize RSSI tracking
    memset(g_rssi_samples, 0, sizeof(g_rssi_samples));
    g_stats.best_rssi = -127;
    g_stats.worst_rssi = 0;
}

// ============================================================
// Loop
// ============================================================
void wifi_loop() {
    unsigned long now = millis();

    // Handle DNS for captive portal in AP mode
    if (g_ap_active) {
        g_dns_server.processNextRequest();
    }

    // RSSI sampling (every 10 seconds)
    if (g_wifi_state == WIFI_STATE_CONNECTED && now - g_last_rssi_sample >= 10000) {
        g_last_rssi_sample = now;
        wifi_update_rssi_stats();
    }

    // Auto-reconnect with exponential backoff
    if (g_wifi_state == WIFI_STATE_DISCONNECTED && !g_ap_active) {
        if (now - g_last_reconnect_attempt >= g_backoff_interval) {
            g_last_reconnect_attempt = now;
            g_retries++;

            LOG_I("WIFI", "Reconnect attempt %d/%d (backoff: %lu ms)",
                  g_retries, WIFI_MAX_RETRIES, g_backoff_interval);

            if (g_retries > WIFI_MAX_RETRIES) {
                LOG_W("WIFI", "Max retries reached, starting AP mode");
                wifi_start_ap();
                g_retries = 0;
                g_backoff_interval = WIFI_BACKOFF_INITIAL_MS;
            } else {
                g_wifi_state = WIFI_STATE_RECONNECTING;
                g_stats.total_reconnects++;

                // Try best saved network via scan
                bool connected = wifi_auto_connect_best();
                if (!connected) {
                    connected = wifi_connect(g_ssid, g_password, WIFI_CONNECT_TIMEOUT_MS);
                }

                if (!connected) {
                    // Exponential backoff with cap
                    g_backoff_interval = min(g_backoff_interval * WIFI_BACKOFF_MULTIPLIER,
                                             (unsigned long)WIFI_BACKOFF_MAX_MS);
                    if (g_active_network_idx >= 0 && g_active_network_idx < g_network_count) {
                        g_networks[g_active_network_idx].fail_count++;
                    }
                }
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
        LOG_I("WIFI", "Connected! IP: %s, RSSI: %d dBm, Channel: %d",
              WiFi.localIP().toString().c_str(), WiFi.RSSI(), WiFi.channel());

        // Start mDNS
        if (MDNS.begin(WIFI_HOSTNAME)) {
            MDNS.addService("http", "tcp", WEB_PORT);
            MDNS.addService("mqtt", "tcp", MQTT_PORT_DEFAULT);
            LOG_I("WIFI", "mDNS started: %s.local", WIFI_HOSTNAME);
        }

        // Find which saved network we connected to
        g_active_network_idx = wifi_find_network(ssid);

        return true;
    }

    g_wifi_state = WIFI_STATE_DISCONNECTED;
    LOG_W("WIFI", "Connection to '%s' failed (timeout)", ssid.c_str());
    return false;
}

void wifi_disconnect() {
    WiFi.disconnect(true);
    g_wifi_state = WIFI_STATE_DISCONNECTED;
    g_active_network_idx = -1;
    LOG_I("WIFI", "Disconnected");
}

// ============================================================
// AP Mode (Captive Portal)
// ============================================================
void wifi_start_ap() {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS);

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
// Multi-Network Management
// ============================================================
bool wifi_add_network(const String& ssid, const String& password, int8_t priority) {
    // Check if already exists
    int idx = wifi_find_network(ssid);
    if (idx >= 0) {
        // Update existing
        strncpy(g_networks[idx].password, password.c_str(), sizeof(g_networks[idx].password) - 1);
        g_networks[idx].priority = priority;
        g_networks[idx].enabled = true;
        wifi_save_networks();
        LOG_I("WIFI", "Updated network '%s' (priority=%d)", ssid.c_str(), priority);
        return true;
    }

    if (g_network_count >= WIFI_MAX_SAVED_NETWORKS) {
        LOG_W("WIFI", "Max saved networks reached (%d)", WIFI_MAX_SAVED_NETWORKS);
        return false;
    }

    SavedNetwork& net = g_networks[g_network_count];
    strncpy(net.ssid, ssid.c_str(), sizeof(net.ssid) - 1);
    net.ssid[sizeof(net.ssid) - 1] = '\0';
    strncpy(net.password, password.c_str(), sizeof(net.password) - 1);
    net.password[sizeof(net.password) - 1] = '\0';
    net.priority = priority;
    net.last_rssi = -100;
    net.connect_count = 0;
    net.fail_count = 0;
    net.enabled = true;
    g_network_count++;

    wifi_save_networks();
    LOG_I("WIFI", "Added network '%s' (priority=%d, total=%d)", ssid.c_str(), priority, g_network_count);
    return true;
}

bool wifi_remove_network(const String& ssid) {
    int idx = wifi_find_network(ssid);
    if (idx < 0) return false;

    // Shift remaining networks down
    for (int i = idx; i < g_network_count - 1; i++) {
        g_networks[i] = g_networks[i + 1];
    }
    g_network_count--;

    wifi_save_networks();
    LOG_I("WIFI", "Removed network '%s' (remaining=%d)", ssid.c_str(), g_network_count);
    return true;
}

int wifi_get_network_count() {
    return g_network_count;
}

bool wifi_auto_connect_best() {
    if (g_network_count == 0) return false;

    LOG_I("WIFI", "Scanning for saved networks...");
    int n = WiFi.scanNetworks(false, false, false, 300);
    if (n <= 0) {
        LOG_W("WIFI", "No networks found in scan");
        WiFi.scanDelete();
        return false;
    }

    int best_idx = wifi_pick_best_network(n);
    WiFi.scanDelete();

    if (best_idx < 0) {
        LOG_W("WIFI", "No saved networks found in scan results");
        return false;
    }

    LOG_I("WIFI", "Best network: '%s' (priority=%d, RSSI=%d)",
          g_networks[best_idx].ssid, g_networks[best_idx].priority,
          g_networks[best_idx].last_rssi);

    return wifi_connect(String(g_networks[best_idx].ssid),
                        String(g_networks[best_idx].password),
                        WIFI_CONNECT_TIMEOUT_MS);
}

String wifi_get_saved_networks_json() {
    JsonDocument doc;
    JsonArray arr = doc["networks"].to<JsonArray>();

    for (int i = 0; i < g_network_count; i++) {
        JsonObject net = arr.add<JsonObject>();
        net["ssid"]      = g_networks[i].ssid;
        net["priority"]  = g_networks[i].priority;
        net["last_rssi"] = g_networks[i].last_rssi;
        net["connects"]  = g_networks[i].connect_count;
        net["fails"]     = g_networks[i].fail_count;
        net["enabled"]   = g_networks[i].enabled;
        net["active"]    = (i == g_active_network_idx && wifi_is_connected());
    }
    doc["count"] = g_network_count;

    String output;
    serializeJson(doc, output);
    return output;
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

String wifi_get_state_string() {
    switch (g_wifi_state) {
        case WIFI_STATE_DISCONNECTED: return "Disconnected";
        case WIFI_STATE_CONNECTING:   return "Connecting";
        case WIFI_STATE_CONNECTED:    return "Connected";
        case WIFI_STATE_AP_MODE:      return "AP Mode";
        case WIFI_STATE_SCANNING:     return "Scanning";
        case WIFI_STATE_RECONNECTING: return "Reconnecting";
        default:                      return "Unknown";
    }
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
    if (rssi <= -100) return 0;
    if (rssi >= -50) return 100;
    return 2 * (rssi + 100);
}

uint32_t wifi_get_uptime() {
    if (!wifi_is_connected()) return 0;
    return (millis() / 1000) - g_stats.current_session_start;
}

// ============================================================
// Statistics
// ============================================================
WiFiStats wifi_get_stats() {
    return g_stats;
}

String wifi_get_stats_json() {
    JsonDocument doc;
    doc["state"]             = wifi_get_state_string();
    doc["ssid"]              = wifi_get_ssid();
    doc["ip"]                = wifi_get_ip();
    doc["rssi"]              = wifi_get_rssi();
    doc["quality"]           = wifi_signal_quality();
    doc["channel"]           = WiFi.channel();
    doc["session_uptime"]    = wifi_get_uptime();
    doc["total_connects"]    = g_stats.total_connects;
    doc["total_disconnects"] = g_stats.total_disconnects;
    doc["total_reconnects"]  = g_stats.total_reconnects;
    doc["longest_session"]   = g_stats.longest_session_sec;
    doc["ap_clients_served"] = g_stats.ap_clients_served;
    doc["best_rssi"]         = g_stats.best_rssi;
    doc["worst_rssi"]        = g_stats.worst_rssi;
    doc["avg_rssi"]          = g_stats.avg_rssi;
    doc["saved_networks"]    = g_network_count;

    String output;
    serializeJson(doc, output);
    return output;
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
        net["saved"]   = (wifi_find_network(WiFi.SSID(i)) >= 0);
    }
    doc["count"] = n;

    String output;
    serializeJson(doc, output);
    WiFi.scanDelete();
    return output;
}

// ============================================================
// Credentials Persistence (legacy compat)
// ============================================================
void wifi_set_credentials(const String& ssid, const String& password) {
    g_ssid = ssid;
    g_password = password;
    wifi_add_network(ssid, password, 10);  // Also add to multi-network system
}

void wifi_save_credentials() {
    prefs_save_string("wifi_ssid", g_ssid);
    prefs_save_string("wifi_pass", g_password);
    LOG_I("WIFI", "Legacy credentials saved");
}

void wifi_load_credentials() {
    String saved_ssid = prefs_get_string("wifi_ssid", "");
    String saved_pass = prefs_get_string("wifi_pass", "");
    if (saved_ssid.length() > 0) {
        g_ssid = saved_ssid;
        g_password = saved_pass;
        LOG_I("WIFI", "Loaded legacy credentials for: %s", g_ssid.c_str());
    }
}

// ============================================================
// Power Management
// ============================================================
void wifi_set_power_save(bool enable) {
    if (enable) {
        esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
        LOG_I("WIFI", "Power save: MIN_MODEM");
    } else {
        esp_wifi_set_ps(WIFI_PS_NONE);
        LOG_I("WIFI", "Power save: OFF");
    }
}

void wifi_set_tx_power(int8_t dbm) {
    WiFi.setTxPower((wifi_power_t)dbm);
    LOG_I("WIFI", "TX power set to %d dBm", dbm);
}

// ============================================================
// Internal Helpers
// ============================================================
static int wifi_find_network(const String& ssid) {
    for (int i = 0; i < g_network_count; i++) {
        if (ssid == g_networks[i].ssid) return i;
    }
    return -1;
}

static int wifi_pick_best_network(int n_scan) {
    int best_idx = -1;
    int best_score = -999;

    for (int i = 0; i < g_network_count; i++) {
        if (!g_networks[i].enabled) continue;

        // Find this network in scan results
        for (int j = 0; j < n_scan; j++) {
            if (WiFi.SSID(j) == g_networks[i].ssid) {
                int rssi = WiFi.RSSI(j);
                g_networks[i].last_rssi = rssi;

                // Score = priority * 10 + RSSI normalization (0-100) - fail_penalty
                int quality = (rssi <= -100) ? 0 : ((rssi >= -50) ? 100 : 2 * (rssi + 100));
                int fail_penalty = min((int)g_networks[i].fail_count * 5, 50);
                int score = g_networks[i].priority * 10 + quality - fail_penalty;

                if (score > best_score) {
                    best_score = score;
                    best_idx = i;
                }
                break;
            }
        }
    }

    return best_idx;
}

static void wifi_update_rssi_stats() {
    int8_t rssi = WiFi.RSSI();
    g_rssi_samples[g_rssi_sample_idx] = rssi;
    g_rssi_sample_idx = (g_rssi_sample_idx + 1) % 10;
    if (g_rssi_sample_count < 10) g_rssi_sample_count++;

    if (rssi > g_stats.best_rssi) g_stats.best_rssi = rssi;
    if (rssi < g_stats.worst_rssi) g_stats.worst_rssi = rssi;

    // Rolling average
    float sum = 0;
    for (int i = 0; i < g_rssi_sample_count; i++) sum += g_rssi_samples[i];
    g_stats.avg_rssi = sum / g_rssi_sample_count;
}

static void wifi_save_networks() {
    g_wifi_prefs.begin(NVS_WIFI_NS, false);
    g_wifi_prefs.putInt("count", g_network_count);
    for (int i = 0; i < g_network_count; i++) {
        String key = "net" + String(i);
        g_wifi_prefs.putBytes(key.c_str(), &g_networks[i], sizeof(SavedNetwork));
    }
    g_wifi_prefs.end();
    LOG_D("WIFI", "Saved %d networks to NVS", g_network_count);
}

static void wifi_load_networks() {
    g_wifi_prefs.begin(NVS_WIFI_NS, true);
    g_network_count = g_wifi_prefs.getInt("count", 0);
    if (g_network_count > WIFI_MAX_SAVED_NETWORKS) g_network_count = WIFI_MAX_SAVED_NETWORKS;

    for (int i = 0; i < g_network_count; i++) {
        String key = "net" + String(i);
        g_wifi_prefs.getBytes(key.c_str(), &g_networks[i], sizeof(SavedNetwork));
    }
    g_wifi_prefs.end();

    if (g_network_count > 0) {
        LOG_I("WIFI", "Loaded %d saved networks from NVS", g_network_count);
    }
}
