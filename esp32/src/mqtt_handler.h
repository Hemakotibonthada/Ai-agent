#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// MQTT Handler Header — Enhanced v2.0
// Offline queue, QoS, command/timer topics, batch publish
// ============================================================

#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Callback type for command processing
typedef void (*MqttCommandCallback)(const String& topic, const JsonDocument& doc);

// Queued message for offline publishing
struct QueuedMessage {
    char   topic[96];
    char   payload[512];
    bool   retained;
    uint8_t priority;  // Higher = more important (0-3)
};

// MQTT connection statistics
struct MqttStats {
    uint32_t messages_sent;
    uint32_t messages_received;
    uint32_t messages_queued;
    uint32_t messages_dropped;
    uint32_t reconnects;
    uint32_t publish_errors;
    unsigned long last_publish_time;
    unsigned long last_receive_time;
    unsigned long connected_since;
    uint32_t connection_uptime_sec;
};

// ---- Core functions ----
void   mqtt_init();
void   mqtt_loop();
bool   mqtt_connect();
void   mqtt_disconnect();
bool   mqtt_is_connected();
void   mqtt_set_command_callback(MqttCommandCallback cb);

// ---- Publishing ----
bool   mqtt_publish(const char* topic, const char* payload, bool retained = false);
bool   mqtt_publish_json(const char* topic, JsonDocument& doc, bool retained = false);
bool   mqtt_publish_sensor(const char* sensor_type, float value, const char* unit);
bool   mqtt_publish_status(const char* status);
bool   mqtt_publish_alert(const char* alert_type, const char* message, int severity);
bool   mqtt_publish_device_state(const char* device_type, int channel, const char* state);

// ---- Offline queue ----
bool   mqtt_queue_message(const char* topic, const char* payload, bool retained = false, uint8_t priority = 1);
int    mqtt_flush_queue();                // Publish all queued messages, returns count sent
int    mqtt_get_queue_count();

// ---- Subscribing ----
bool   mqtt_subscribe(const char* topic, uint8_t qos = 0);

// ---- Configuration ----
void   mqtt_set_broker(const String& host, uint16_t port);
void   mqtt_set_credentials(const String& user, const String& pass);
void   mqtt_save_config();
void   mqtt_load_config();

// ---- Stats ----
uint32_t mqtt_get_messages_sent();
uint32_t mqtt_get_messages_received();
unsigned long mqtt_get_last_publish_time();
MqttStats mqtt_get_stats();
String    mqtt_get_stats_json();

// ---- Batch publish ----
void   mqtt_publish_all_sensors();
void   mqtt_publish_all_device_states();

#endif // MQTT_HANDLER_H
