// ============================================================
// Nexus AI OS - ESP32 Home Automation
// MQTT Handler Implementation — Enhanced v2.0
// Offline queue, QoS, command/timer topics, batch publish
// ============================================================

#include "mqtt_handler.h"
#include "config.h"
#include "utils.h"
#include "sensors.h"
#include "actuators.h"
#include "power_monitor.h"
#include "wifi_manager.h"
#include "eeprom_manager.h"
#include <WiFi.h>

// ---- State ----
static WiFiClient         g_wifi_client;
static PubSubClient       g_mqtt(g_wifi_client);
static String             g_broker = MQTT_BROKER_DEFAULT;
static uint16_t           g_port   = MQTT_PORT_DEFAULT;
static String             g_user   = MQTT_USER_DEFAULT;
static String             g_pass   = MQTT_PASS_DEFAULT;
static MqttCommandCallback g_cmd_callback = nullptr;
static unsigned long      g_last_reconnect = 0;
static unsigned long      g_last_publish = 0;
static char               g_json_buf[MQTT_BUFFER_SIZE];

// ---- Offline message queue ----
static QueuedMessage      g_queue[MQTT_OFFLINE_QUEUE_SIZE];
static int                g_queue_head = 0;
static int                g_queue_tail = 0;
static int                g_queue_count = 0;

// ---- Statistics ----
static MqttStats          g_stats = {};

// ---- Backoff for reconnect ----
static unsigned long      g_reconnect_backoff = MQTT_RECONNECT_INTERVAL;

// ---- Forward declarations ----
static void mqtt_callback(char* topic, byte* payload, unsigned int length);
static void mqtt_process_command(const String& topic, const String& payload);
static void mqtt_subscribe_topics();
static bool mqtt_queue_push(const QueuedMessage& msg);
static bool mqtt_queue_pop(QueuedMessage& msg);

// ============================================================
// Init
// ============================================================
void mqtt_init() {
    mqtt_load_config();
    g_mqtt.setServer(g_broker.c_str(), g_port);
    g_mqtt.setCallback(mqtt_callback);
    g_mqtt.setBufferSize(MQTT_BUFFER_SIZE);
    g_mqtt.setKeepAlive(MQTT_KEEPALIVE);

    memset(&g_stats, 0, sizeof(g_stats));
    g_queue_count = 0;
    g_queue_head = 0;
    g_queue_tail = 0;

    LOG_I("MQTT", "MQTT v2.0 initialized. Broker: %s:%d (queue size: %d)",
          g_broker.c_str(), g_port, MQTT_OFFLINE_QUEUE_SIZE);
}

// ============================================================
// Loop
// ============================================================
void mqtt_loop() {
    if (!wifi_is_connected()) return;

    if (!g_mqtt.connected()) {
        unsigned long now = millis();
        if (now - g_last_reconnect >= g_reconnect_backoff) {
            g_last_reconnect = now;
            if (mqtt_connect()) {
                g_reconnect_backoff = MQTT_RECONNECT_INTERVAL;

                // Flush queued messages
                if (g_queue_count > 0) {
                    LOG_I("MQTT", "Flushing %d queued messages...", g_queue_count);
                    int flushed = mqtt_flush_queue();
                    LOG_I("MQTT", "Flushed %d messages", flushed);
                }
            } else {
                // Exponential backoff with cap
                g_reconnect_backoff = min(g_reconnect_backoff * 2, (unsigned long)60000);
            }
        }
    } else {
        g_mqtt.loop();
    }

    // Periodic sensor publish
    unsigned long now = millis();
    if (g_mqtt.connected() && (now - g_last_publish >= INTERVAL_MQTT_PUB)) {
        g_last_publish = now;
        mqtt_publish_all_sensors();
    }
}

// ============================================================
// Connect / Disconnect
// ============================================================
bool mqtt_connect() {
    if (g_mqtt.connected()) return true;

    LOG_I("MQTT", "Connecting to %s:%d...", g_broker.c_str(), g_port);
    g_stats.reconnects++;

    // Last Will Testament
    String will_topic = TOPIC_STATUS;
    String will_msg = "{\"device\":\"" + String(DEVICE_ID) + "\",\"status\":\"offline\",\"timestamp\":\"" + get_timestamp() + "\"}";

    bool connected = false;
    if (g_user.length() > 0) {
        connected = g_mqtt.connect(MQTT_CLIENT_ID, g_user.c_str(), g_pass.c_str(),
                                   will_topic.c_str(), MQTT_QOS_STATUS, true, will_msg.c_str());
    } else {
        connected = g_mqtt.connect(MQTT_CLIENT_ID,
                                   will_topic.c_str(), MQTT_QOS_STATUS, true, will_msg.c_str());
    }

    if (connected) {
        LOG_I("MQTT", "Connected! Subscribing to topics...");
        g_stats.connected_since = millis() / 1000;
        mqtt_subscribe_topics();

        // Publish online status (retained)
        JsonDocument doc;
        doc["device"]    = DEVICE_ID;
        doc["status"]    = "online";
        doc["firmware"]  = String(FW_VERSION_MAJOR) + "." + String(FW_VERSION_MINOR) + "." + String(FW_VERSION_PATCH);
        doc["ip"]        = wifi_get_ip();
        doc["rssi"]      = wifi_get_rssi();
        doc["boot_count"] = eeprom_get_boot_count();
        doc["uptime"]    = get_uptime_string();
        doc["timestamp"] = get_timestamp();
        mqtt_publish_json(TOPIC_STATUS, doc, true);

        // Also publish all current device states
        mqtt_publish_all_device_states();

        return true;
    }

    LOG_E("MQTT", "Connection failed, rc=%d", g_mqtt.state());
    return false;
}

void mqtt_disconnect() {
    if (g_mqtt.connected()) {
        mqtt_publish_status("offline");
        g_mqtt.disconnect();

        // Track session uptime
        g_stats.connection_uptime_sec += (millis() / 1000) - g_stats.connected_since;

        LOG_I("MQTT", "Disconnected (session: %us)", (millis() / 1000) - g_stats.connected_since);
    }
}

bool mqtt_is_connected() {
    return g_mqtt.connected();
}

// ============================================================
// Subscribe to control topics — Enhanced for v2.0
// ============================================================
static void mqtt_subscribe_topics() {
    // Light control (4 channels)
    for (int i = 1; i <= 4; i++) {
        String topic = String(TOPIC_DEVICE_LIGHT) + "/" + String(i) + "/control";
        g_mqtt.subscribe(topic.c_str(), MQTT_QOS_COMMAND);
        LOG_D("MQTT", "Subscribed: %s (QoS %d)", topic.c_str(), MQTT_QOS_COMMAND);
    }

    g_mqtt.subscribe(TOPIC_DEVICE_FAN, MQTT_QOS_COMMAND);
    g_mqtt.subscribe(TOPIC_DEVICE_AC, MQTT_QOS_COMMAND);
    g_mqtt.subscribe(TOPIC_SCENE, MQTT_QOS_COMMAND);

    // v2.0: General command topic
    g_mqtt.subscribe(TOPIC_COMMAND, MQTT_QOS_COMMAND);

    // v2.0: Timer management topic
    g_mqtt.subscribe(TOPIC_TIMER, MQTT_QOS_COMMAND);

    // Wildcard for home control
    g_mqtt.subscribe("home/+/control", 0);

    LOG_I("MQTT", "Subscribed to all control topics (including v2.0 command/timer)");
}

// ============================================================
// MQTT Callback
// ============================================================
static void mqtt_callback(char* topic, byte* payload, unsigned int length) {
    g_stats.messages_received++;
    g_stats.last_receive_time = millis();

    // Convert payload to string
    String msg;
    msg.reserve(length + 1);
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }

    LOG_D("MQTT", "RX [%s]: %s", topic, msg.c_str());
    mqtt_process_command(String(topic), msg);
}

// ============================================================
// Command Processing — Enhanced for v2.0
// ============================================================
static void mqtt_process_command(const String& topic, const String& payload) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
        LOG_W("MQTT", "JSON parse error: %s", err.c_str());
        return;
    }

    // ---- Light control: home/devices/light/{1-4}/control ----
    if (topic.startsWith(TOPIC_DEVICE_LIGHT)) {
        int channel = topic.substring(String(TOPIC_DEVICE_LIGHT).length() + 1,
                                      topic.indexOf("/control")).toInt();
        if (channel >= 1 && channel <= 4) {
            int ch = channel - 1;

            if (doc["action"] == "ON") {
                light_set(ch, true);
                LOG_I("MQTT", "Light %d ON", channel);
            } else if (doc["action"] == "OFF") {
                light_set(ch, false);
                LOG_I("MQTT", "Light %d OFF", channel);
            } else if (doc["action"] == "TOGGLE") {
                light_set(ch, !light_get_state(ch));
                LOG_I("MQTT", "Light %d toggled -> %s", channel, light_get_state(ch) ? "ON" : "OFF");
            }

            if (doc.containsKey("brightness")) {
                uint8_t bri = doc["brightness"].as<uint8_t>();
                light_set_brightness(ch, bri);
                LOG_I("MQTT", "Light %d brightness: %d", channel, bri);
            }

            mqtt_publish_device_state("light", channel, light_get_state(ch) ? "ON" : "OFF");
            eeprom_mark_state_dirty();
        }
        return;
    }

    // ---- Fan control ----
    if (topic == TOPIC_DEVICE_FAN) {
        if (doc["action"] == "ON") fan_set(true);
        else if (doc["action"] == "OFF") fan_set(false);
        else if (doc["action"] == "TOGGLE") fan_set(!fan_get_state());

        if (doc.containsKey("speed")) {
            fan_set_speed(doc["speed"].as<uint8_t>());
        }
        mqtt_publish_device_state("fan", 0, fan_get_state() ? "ON" : "OFF");
        eeprom_mark_state_dirty();
        return;
    }

    // ---- AC control ----
    if (topic == TOPIC_DEVICE_AC) {
        if (doc["action"] == "ON" || doc["action"] == "OFF") {
            ac_power_toggle();
        }
        if (doc.containsKey("temperature")) {
            ac_set_temperature(doc["temperature"].as<int>());
        }
        if (doc.containsKey("mode")) {
            ac_set_mode(doc["mode"]);
        }
        if (doc.containsKey("fan_speed")) {
            ac_set_fan_speed(doc["fan_speed"]);
        }
        eeprom_mark_state_dirty();
        return;
    }

    // ---- Scene activation ----
    if (topic == TOPIC_SCENE) {
        if (doc.containsKey("scene")) {
            scene_activate(doc["scene"]);
            LOG_I("MQTT", "Scene: %s", doc["scene"].as<const char*>());
            eeprom_mark_state_dirty();
        }
        return;
    }

    // ---- v2.0: General command topic ----
    if (topic == TOPIC_COMMAND) {
        String cmd = doc["command"] | "";

        if (cmd == "reboot") {
            LOG_I("MQTT", "Reboot requested via MQTT");
            mqtt_publish_status("rebooting");
            delay(500);
            ESP.restart();
        } else if (cmd == "factory_reset") {
            LOG_I("MQTT", "Factory reset requested via MQTT");
            eeprom_factory_reset();
            delay(500);
            ESP.restart();
        } else if (cmd == "status") {
            mqtt_publish_status("online");
        } else if (cmd == "save_state") {
            eeprom_mark_state_dirty();
            LOG_I("MQTT", "State save triggered via MQTT");
        } else if (cmd == "device_states") {
            mqtt_publish_all_device_states();
        } else if (cmd == "set_brightness") {
            int ch = doc["channel"] | -1;
            int bri = doc["value"] | 255;
            if (ch >= 0 && ch < MAX_LIGHTS) {
                light_set_brightness(ch, bri);
                eeprom_mark_state_dirty();
            }
        } else if (cmd == "set_neopixel") {
            int r = doc["r"] | 0;
            int g = doc["g"] | 0;
            int b = doc["b"] | 0;
            neopixel_set_color(r, g, b);
        } else {
            LOG_W("MQTT", "Unknown command: %s", cmd.c_str());
        }
        return;
    }

    // ---- v2.0: Timer management topic ----
    if (topic == TOPIC_TIMER) {
        String action = doc["action"] | "";

        if (action == "add") {
            ScheduledTimer timer = {};
            timer.hour = doc["hour"] | 0;
            timer.minute = doc["minute"] | 0;
            timer.device_type = doc["device_type"] | 0;
            timer.channel = doc["channel"] | 0;
            timer.target_state = doc["state"] | false;
            timer.days_mask = doc["days"] | 0x7F;  // All days by default
            timer.one_shot = doc["one_shot"] | false;
            timer.active = true;

            // Save timer via EEPROM manager
            ScheduledTimer timers[MAX_SCHEDULED_TIMERS];
            int count = eeprom_load_timers(timers, MAX_SCHEDULED_TIMERS);
            if (count < MAX_SCHEDULED_TIMERS) {
                timers[count] = timer;
                eeprom_save_timers(timers, count + 1);
                LOG_I("MQTT", "Timer added: %02d:%02d dev=%d ch=%d -> %s",
                      timer.hour, timer.minute, timer.device_type, timer.channel,
                      timer.target_state ? "ON" : "OFF");

                // Acknowledge
                JsonDocument ack;
                ack["action"] = "timer_added";
                ack["index"] = count;
                ack["success"] = true;
                mqtt_publish_json(TOPIC_TIMER, ack, false);
            }
        } else if (action == "remove") {
            int idx = doc["index"] | -1;
            if (idx >= 0) {
                ScheduledTimer timers[MAX_SCHEDULED_TIMERS];
                int count = eeprom_load_timers(timers, MAX_SCHEDULED_TIMERS);
                if (idx < count) {
                    for (int i = idx; i < count - 1; i++) {
                        timers[i] = timers[i + 1];
                    }
                    eeprom_save_timers(timers, count - 1);
                    LOG_I("MQTT", "Timer %d removed", idx);
                }
            }
        } else if (action == "list") {
            ScheduledTimer timers[MAX_SCHEDULED_TIMERS];
            int count = eeprom_load_timers(timers, MAX_SCHEDULED_TIMERS);

            JsonDocument list_doc;
            JsonArray arr = list_doc["timers"].to<JsonArray>();
            for (int i = 0; i < count; i++) {
                JsonObject t = arr.add<JsonObject>();
                t["index"] = i;
                t["hour"] = timers[i].hour;
                t["minute"] = timers[i].minute;
                t["device_type"] = timers[i].device_type;
                t["channel"] = timers[i].channel;
                t["state"] = timers[i].target_state;
                t["days"] = timers[i].days_mask;
                t["one_shot"] = timers[i].one_shot;
                t["active"] = timers[i].active;
            }
            list_doc["count"] = count;
            mqtt_publish_json(TOPIC_TIMER, list_doc, false);
        }
        return;
    }

    // Forward to external callback if set
    if (g_cmd_callback) {
        g_cmd_callback(topic, doc);
    }
}

// ============================================================
// Offline Message Queue
// ============================================================
static bool mqtt_queue_push(const QueuedMessage& msg) {
    if (g_queue_count >= MQTT_OFFLINE_QUEUE_SIZE) {
        // Drop lowest priority message to make room
        g_stats.messages_dropped++;
        LOG_W("MQTT", "Queue full, dropping oldest message");
        g_queue_tail = (g_queue_tail + 1) % MQTT_OFFLINE_QUEUE_SIZE;
        g_queue_count--;
    }

    g_queue[g_queue_head] = msg;
    g_queue_head = (g_queue_head + 1) % MQTT_OFFLINE_QUEUE_SIZE;
    g_queue_count++;
    g_stats.messages_queued++;
    return true;
}

static bool mqtt_queue_pop(QueuedMessage& msg) {
    if (g_queue_count == 0) return false;
    msg = g_queue[g_queue_tail];
    g_queue_tail = (g_queue_tail + 1) % MQTT_OFFLINE_QUEUE_SIZE;
    g_queue_count--;
    return true;
}

bool mqtt_queue_message(const char* topic, const char* payload, bool retained, uint8_t priority) {
    QueuedMessage msg;
    strncpy(msg.topic, topic, sizeof(msg.topic) - 1);
    msg.topic[sizeof(msg.topic) - 1] = '\0';
    strncpy(msg.payload, payload, sizeof(msg.payload) - 1);
    msg.payload[sizeof(msg.payload) - 1] = '\0';
    msg.retained = retained;
    msg.priority = priority;
    return mqtt_queue_push(msg);
}

int mqtt_flush_queue() {
    int sent = 0;
    QueuedMessage msg;
    while (mqtt_queue_pop(msg)) {
        if (g_mqtt.connected()) {
            if (g_mqtt.publish(msg.topic, msg.payload, msg.retained)) {
                g_stats.messages_sent++;
                sent++;
            } else {
                g_stats.publish_errors++;
            }
        }
        yield();  // Don't block too long
    }
    return sent;
}

int mqtt_get_queue_count() {
    return g_queue_count;
}

// ============================================================
// Publishing — Enhanced with queue fallback
// ============================================================
bool mqtt_publish(const char* topic, const char* payload, bool retained) {
    if (!g_mqtt.connected()) {
        // Queue for later
        return mqtt_queue_message(topic, payload, retained, 1);
    }
    bool ok = g_mqtt.publish(topic, payload, retained);
    if (ok) {
        g_stats.messages_sent++;
        g_stats.last_publish_time = millis();
    } else {
        g_stats.publish_errors++;
        // Queue on publish failure
        mqtt_queue_message(topic, payload, retained, 1);
    }
    return ok;
}

bool mqtt_publish_json(const char* topic, JsonDocument& doc, bool retained) {
    size_t len = serializeJson(doc, g_json_buf, sizeof(g_json_buf));
    if (len == 0) return false;
    return mqtt_publish(topic, g_json_buf, retained);
}

bool mqtt_publish_sensor(const char* sensor_type, float value, const char* unit) {
    JsonDocument doc;
    doc["type"]      = sensor_type;
    doc["value"]     = serialized(float_to_string(value, 2));
    doc["unit"]      = unit;
    doc["device"]    = DEVICE_ID;
    doc["timestamp"] = get_timestamp();

    String topic = String(TOPIC_PREFIX) + "/sensors/" + sensor_type;
    return mqtt_publish_json(topic.c_str(), doc, false);
}

bool mqtt_publish_status(const char* status) {
    JsonDocument doc;
    doc["device"]      = DEVICE_ID;
    doc["status"]      = status;
    doc["ip"]          = wifi_get_ip();
    doc["rssi"]        = wifi_get_rssi();
    doc["quality"]     = wifi_signal_quality();
    doc["uptime"]      = get_uptime_string();
    doc["heap"]        = get_free_heap();
    doc["boot_count"]  = eeprom_get_boot_count();
    doc["mqtt_sent"]   = g_stats.messages_sent;
    doc["mqtt_recv"]   = g_stats.messages_received;
    doc["mqtt_queued"] = g_queue_count;
    doc["timestamp"]   = get_timestamp();
    return mqtt_publish_json(TOPIC_STATUS, doc, true);
}

bool mqtt_publish_alert(const char* alert_type, const char* message, int severity) {
    JsonDocument doc;
    doc["type"]      = alert_type;
    doc["message"]   = message;
    doc["severity"]  = severity;
    doc["device"]    = DEVICE_ID;
    doc["timestamp"] = get_timestamp();

    // Alerts are high priority — queue even if offline
    if (!g_mqtt.connected()) {
        size_t len = serializeJson(doc, g_json_buf, sizeof(g_json_buf));
        if (len > 0) {
            mqtt_queue_message(TOPIC_ALERT, g_json_buf, false, 3);  // Priority 3 = critical
        }
        return false;
    }
    return mqtt_publish_json(TOPIC_ALERT, doc, false);
}

bool mqtt_publish_device_state(const char* device_type, int channel, const char* state) {
    JsonDocument doc;
    doc["device_type"] = device_type;
    doc["channel"]     = channel;
    doc["state"]       = state;
    doc["device"]      = DEVICE_ID;
    doc["timestamp"]   = get_timestamp();

    if (String(device_type) == "light" && channel > 0) {
        doc["brightness"] = light_get_brightness(channel - 1);
    } else if (String(device_type) == "fan") {
        doc["speed"] = fan_get_speed();
    } else if (String(device_type) == "ac") {
        doc["set_temp"] = ac_get_set_temp();
        doc["mode"]     = ac_get_mode();
    }

    String topic = String(TOPIC_PREFIX) + "/devices/" + device_type;
    if (channel > 0) topic += "/" + String(channel);
    topic += "/state";
    return mqtt_publish_json(topic.c_str(), doc, true);
}

bool mqtt_subscribe(const char* topic, uint8_t qos) {
    return g_mqtt.subscribe(topic, qos);
}

// ============================================================
// Publish all sensor data
// ============================================================
void mqtt_publish_all_sensors() {
    SensorData sd = sensors_get_data();
    PowerData pd  = power_get_data();

    mqtt_publish_sensor("temperature",  sd.temperature, "°C");
    mqtt_publish_sensor("humidity",     sd.humidity, "%");
    mqtt_publish_sensor("air_quality",  sd.air_quality_ppm, "ppm");
    mqtt_publish_sensor("gas",          (float)sd.gas_raw, "raw");
    mqtt_publish_sensor("water_level",  sd.water_level_pct, "%");
    mqtt_publish_sensor("power",        pd.power_watts, "W");

    // Motion event
    if (sd.motion_detected) {
        JsonDocument doc;
        doc["detected"]  = true;
        doc["device"]    = DEVICE_ID;
        doc["timestamp"] = get_timestamp();
        mqtt_publish_json(TOPIC_SENSORS_MOTION, doc, false);
    }

    // Door/window sensors
    {
        JsonDocument doc;
        doc["door1"]     = sd.door1_open ? "open" : "closed";
        doc["door2"]     = sd.door2_open ? "open" : "closed";
        doc["device"]    = DEVICE_ID;
        doc["timestamp"] = get_timestamp();
        mqtt_publish_json(TOPIC_SENSORS_DOOR, doc, true);
    }

    // Energy summary
    {
        JsonDocument doc;
        doc["current_amps"] = serialized(float_to_string(pd.current_rms, 3));
        doc["power_watts"]  = serialized(float_to_string(pd.power_watts, 1));
        doc["energy_kwh"]   = serialized(float_to_string(pd.energy_kwh, 3));
        doc["daily_kwh"]    = serialized(float_to_string(pd.daily_kwh, 3));
        doc["monthly_kwh"]  = serialized(float_to_string(pd.monthly_kwh, 3));
        doc["daily_cost"]   = serialized(float_to_string(pd.daily_cost, 2));
        doc["monthly_cost"] = serialized(float_to_string(pd.monthly_cost, 2));
        doc["device"]       = DEVICE_ID;
        doc["timestamp"]    = get_timestamp();
        mqtt_publish_json("home/sensors/energy", doc, false);
    }

    LOG_D("MQTT", "Published all sensor data (TX: %u total)", g_stats.messages_sent);
}

// ============================================================
// Publish all device states (on connect)
// ============================================================
void mqtt_publish_all_device_states() {
    for (int i = 0; i < MAX_LIGHTS; i++) {
        mqtt_publish_device_state("light", i + 1, light_get_state(i) ? "ON" : "OFF");
    }
    mqtt_publish_device_state("fan", 0, fan_get_state() ? "ON" : "OFF");
    mqtt_publish_device_state("ac", 0, ac_get_state() ? "ON" : "OFF");
    LOG_D("MQTT", "Published all device states");
}

// ============================================================
// Configuration
// ============================================================
void mqtt_set_command_callback(MqttCommandCallback cb) {
    g_cmd_callback = cb;
}

void mqtt_set_broker(const String& host, uint16_t port) {
    g_broker = host;
    g_port = port;
    g_mqtt.setServer(g_broker.c_str(), g_port);
}

void mqtt_set_credentials(const String& user, const String& pass) {
    g_user = user;
    g_pass = pass;
}

void mqtt_save_config() {
    prefs_save_string("mqtt_host", g_broker);
    prefs_save_int("mqtt_port", g_port);
    prefs_save_string("mqtt_user", g_user);
    prefs_save_string("mqtt_pass", g_pass);
    LOG_I("MQTT", "Config saved");
}

void mqtt_load_config() {
    String host = prefs_get_string("mqtt_host", "");
    if (host.length() > 0) {
        g_broker = host;
        g_port   = (uint16_t)prefs_get_int("mqtt_port", MQTT_PORT_DEFAULT);
        g_user   = prefs_get_string("mqtt_user", "");
        g_pass   = prefs_get_string("mqtt_pass", "");
        LOG_I("MQTT", "Loaded saved config: %s:%d", g_broker.c_str(), g_port);
    }
}

// ============================================================
// Stats
// ============================================================
uint32_t mqtt_get_messages_sent()     { return g_stats.messages_sent; }
uint32_t mqtt_get_messages_received() { return g_stats.messages_received; }
unsigned long mqtt_get_last_publish_time() { return g_stats.last_publish_time; }

MqttStats mqtt_get_stats() {
    g_stats.connection_uptime_sec = g_mqtt.connected()
        ? (millis() / 1000) - g_stats.connected_since
        : g_stats.connection_uptime_sec;
    return g_stats;
}

String mqtt_get_stats_json() {
    MqttStats s = mqtt_get_stats();
    JsonDocument doc;
    doc["connected"]      = g_mqtt.connected();
    doc["broker"]         = g_broker;
    doc["port"]           = g_port;
    doc["sent"]           = s.messages_sent;
    doc["received"]       = s.messages_received;
    doc["queued"]         = g_queue_count;
    doc["dropped"]        = s.messages_dropped;
    doc["errors"]         = s.publish_errors;
    doc["reconnects"]     = s.reconnects;
    doc["conn_uptime"]    = s.connection_uptime_sec;
    doc["last_pub_ms"]    = s.last_publish_time;
    doc["last_recv_ms"]   = s.last_receive_time;

    String output;
    serializeJson(doc, output);
    return output;
}
