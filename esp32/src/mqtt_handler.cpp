// ============================================================
// Nexus AI OS - ESP32 Home Automation
// MQTT Handler Implementation
// ============================================================

#include "mqtt_handler.h"
#include "config.h"
#include "utils.h"
#include "sensors.h"
#include "actuators.h"
#include "power_monitor.h"
#include "wifi_manager.h"
#include <WiFi.h>

// ---- State ----
static WiFiClient       g_wifi_client;
static PubSubClient     g_mqtt(g_wifi_client);
static String           g_broker = MQTT_BROKER_DEFAULT;
static uint16_t         g_port   = MQTT_PORT_DEFAULT;
static String           g_user   = MQTT_USER_DEFAULT;
static String           g_pass   = MQTT_PASS_DEFAULT;
static MqttCommandCallback g_cmd_callback = nullptr;
static unsigned long    g_last_reconnect = 0;
static unsigned long    g_last_publish = 0;
static uint32_t         g_msg_sent = 0;
static uint32_t         g_msg_recv = 0;
static char             g_json_buf[MQTT_BUFFER_SIZE];

// ---- Forward declarations ----
static void mqtt_callback(char* topic, byte* payload, unsigned int length);
static void mqtt_process_command(const String& topic, const String& payload);
static void mqtt_subscribe_topics();

// ============================================================
// Init
// ============================================================
void mqtt_init() {
    mqtt_load_config();
    g_mqtt.setServer(g_broker.c_str(), g_port);
    g_mqtt.setCallback(mqtt_callback);
    g_mqtt.setBufferSize(MQTT_BUFFER_SIZE);
    g_mqtt.setKeepAlive(MQTT_KEEPALIVE);

    LOG_I("MQTT", "MQTT initialized. Broker: %s:%d", g_broker.c_str(), g_port);
}

// ============================================================
// Loop
// ============================================================
void mqtt_loop() {
    if (!wifi_is_connected()) return;

    if (!g_mqtt.connected()) {
        unsigned long now = millis();
        if (now - g_last_reconnect >= MQTT_RECONNECT_INTERVAL) {
            g_last_reconnect = now;
            mqtt_connect();
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

    // Last Will Testament - mark device offline on disconnect
    String will_topic = TOPIC_STATUS;
    String will_msg = "{\"device\":\"" + String(DEVICE_ID) + "\",\"status\":\"offline\",\"timestamp\":\"" + get_timestamp() + "\"}";

    bool connected = false;
    if (g_user.length() > 0) {
        connected = g_mqtt.connect(MQTT_CLIENT_ID, g_user.c_str(), g_pass.c_str(),
                                   will_topic.c_str(), 1, true, will_msg.c_str());
    } else {
        connected = g_mqtt.connect(MQTT_CLIENT_ID,
                                   will_topic.c_str(), 1, true, will_msg.c_str());
    }

    if (connected) {
        LOG_I("MQTT", "Connected!");
        mqtt_subscribe_topics();

        // Publish online status (retained)
        String online_msg = "{\"device\":\"" + String(DEVICE_ID) + "\",\"status\":\"online\","
                            "\"firmware\":\"" + String(FW_VERSION_MAJOR) + "." + String(FW_VERSION_MINOR) + "." + String(FW_VERSION_PATCH) + "\","
                            "\"ip\":\"" + wifi_get_ip() + "\","
                            "\"timestamp\":\"" + get_timestamp() + "\"}";
        mqtt_publish(TOPIC_STATUS, online_msg.c_str(), true);

        return true;
    }

    LOG_E("MQTT", "Connection failed, rc=%d", g_mqtt.state());
    return false;
}

void mqtt_disconnect() {
    if (g_mqtt.connected()) {
        mqtt_publish_status("offline");
        g_mqtt.disconnect();
        LOG_I("MQTT", "Disconnected");
    }
}

bool mqtt_is_connected() {
    return g_mqtt.connected();
}

// ============================================================
// Subscribe to control topics
// ============================================================
static void mqtt_subscribe_topics() {
    // Light control (4 channels)
    for (int i = 1; i <= 4; i++) {
        String topic = String(TOPIC_DEVICE_LIGHT) + "/" + String(i) + "/control";
        g_mqtt.subscribe(topic.c_str(), 1);
        LOG_D("MQTT", "Subscribed: %s", topic.c_str());
    }

    g_mqtt.subscribe(TOPIC_DEVICE_FAN, 1);
    g_mqtt.subscribe(TOPIC_DEVICE_AC, 1);
    g_mqtt.subscribe(TOPIC_SCENE, 1);
    g_mqtt.subscribe("home/+/control", 0);

    LOG_I("MQTT", "Subscribed to all control topics");
}

// ============================================================
// MQTT Callback
// ============================================================
static void mqtt_callback(char* topic, byte* payload, unsigned int length) {
    g_msg_recv++;

    // Convert payload to string
    String msg;
    msg.reserve(length + 1);
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }

    LOG_D("MQTT", "Received [%s]: %s", topic, msg.c_str());
    mqtt_process_command(String(topic), msg);
}

// ============================================================
// Command Processing
// ============================================================
static void mqtt_process_command(const String& topic, const String& payload) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
        LOG_W("MQTT", "JSON parse error: %s", err.c_str());
        return;
    }

    // Light control: home/devices/light/{1-4}/control
    if (topic.startsWith(TOPIC_DEVICE_LIGHT)) {
        int channel = topic.substring(String(TOPIC_DEVICE_LIGHT).length() + 1,
                                      topic.indexOf("/control")).toInt();
        if (channel >= 1 && channel <= 4) {
            int ch = channel - 1; // 0-indexed

            if (doc["action"] == "ON") {
                light_set(ch, true);
                LOG_I("MQTT", "Light %d ON", channel);
            } else if (doc["action"] == "OFF") {
                light_set(ch, false);
                LOG_I("MQTT", "Light %d OFF", channel);
            }

            if (doc.containsKey("brightness")) {
                uint8_t bri = doc["brightness"].as<uint8_t>();
                light_set_brightness(ch, bri);
                LOG_I("MQTT", "Light %d brightness: %d", channel, bri);
            }

            // Publish state back
            mqtt_publish_device_state("light", channel,
                light_get_state(ch) ? "ON" : "OFF");
        }
        return;
    }

    // Fan control: home/devices/fan/control
    if (topic == TOPIC_DEVICE_FAN) {
        if (doc["action"] == "ON") {
            fan_set(true);
            LOG_I("MQTT", "Fan ON");
        } else if (doc["action"] == "OFF") {
            fan_set(false);
            LOG_I("MQTT", "Fan OFF");
        }
        if (doc.containsKey("speed")) {
            uint8_t spd = doc["speed"].as<uint8_t>();
            fan_set_speed(spd);
            LOG_I("MQTT", "Fan speed: %d%%", spd);
        }
        mqtt_publish_device_state("fan", 0, fan_get_state() ? "ON" : "OFF");
        return;
    }

    // AC control: home/devices/ac/control
    if (topic == TOPIC_DEVICE_AC) {
        if (doc["action"] == "ON" || doc["action"] == "OFF") {
            ac_power_toggle();
            LOG_I("MQTT", "AC power toggle");
        }
        if (doc.containsKey("temperature")) {
            int temp = doc["temperature"].as<int>();
            ac_set_temperature(temp);
            LOG_I("MQTT", "AC temp: %d", temp);
        }
        if (doc.containsKey("mode")) {
            const char* mode = doc["mode"];
            ac_set_mode(mode);
            LOG_I("MQTT", "AC mode: %s", mode);
        }
        if (doc.containsKey("fan_speed")) {
            const char* fs = doc["fan_speed"];
            ac_set_fan_speed(fs);
            LOG_I("MQTT", "AC fan: %s", fs);
        }
        return;
    }

    // Scene activation: home/scene/activate
    if (topic == TOPIC_SCENE) {
        if (doc.containsKey("scene")) {
            const char* scene = doc["scene"];
            scene_activate(scene);
            LOG_I("MQTT", "Scene activated: %s", scene);
        }
        return;
    }

    // Forward to external callback if set
    if (g_cmd_callback) {
        g_cmd_callback(topic, doc);
    }
}

// ============================================================
// Publishing
// ============================================================
bool mqtt_publish(const char* topic, const char* payload, bool retained) {
    if (!g_mqtt.connected()) return false;
    bool ok = g_mqtt.publish(topic, payload, retained);
    if (ok) g_msg_sent++;
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
    doc["device"]    = DEVICE_ID;
    doc["status"]    = status;
    doc["ip"]        = wifi_get_ip();
    doc["rssi"]      = wifi_get_rssi();
    doc["uptime"]    = get_uptime_string();
    doc["heap"]      = get_free_heap();
    doc["timestamp"] = get_timestamp();
    return mqtt_publish_json(TOPIC_STATUS, doc, true);
}

bool mqtt_publish_alert(const char* alert_type, const char* message, int severity) {
    JsonDocument doc;
    doc["type"]      = alert_type;
    doc["message"]   = message;
    doc["severity"]  = severity;  // 1=info, 2=warning, 3=critical
    doc["device"]    = DEVICE_ID;
    doc["timestamp"] = get_timestamp();
    return mqtt_publish_json(TOPIC_ALERT, doc, false);
}

bool mqtt_publish_device_state(const char* device_type, int channel, const char* state) {
    JsonDocument doc;
    doc["device_type"] = device_type;
    doc["channel"]     = channel;
    doc["state"]       = state;
    doc["device"]      = DEVICE_ID;
    doc["timestamp"]   = get_timestamp();

    // Add extra info based on device type
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

    // Motion event (only publish on detection)
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

    LOG_D("MQTT", "Published all sensor data");
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
uint32_t mqtt_get_messages_sent() { return g_msg_sent; }
uint32_t mqtt_get_messages_received() { return g_msg_recv; }
unsigned long mqtt_get_last_publish_time() { return g_last_publish; }
