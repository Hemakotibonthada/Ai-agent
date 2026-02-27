#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// MQTT Handler Header
// ============================================================

#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Callback type for command processing
typedef void (*MqttCommandCallback)(const String& topic, const JsonDocument& doc);

void   mqtt_init();
void   mqtt_loop();
bool   mqtt_connect();
void   mqtt_disconnect();
bool   mqtt_is_connected();
void   mqtt_set_command_callback(MqttCommandCallback cb);

// Publishing
bool   mqtt_publish(const char* topic, const char* payload, bool retained = false);
bool   mqtt_publish_json(const char* topic, JsonDocument& doc, bool retained = false);
bool   mqtt_publish_sensor(const char* sensor_type, float value, const char* unit);
bool   mqtt_publish_status(const char* status);
bool   mqtt_publish_alert(const char* alert_type, const char* message, int severity);
bool   mqtt_publish_device_state(const char* device_type, int channel, const char* state);

// Subscribing
bool   mqtt_subscribe(const char* topic, uint8_t qos = 0);

// Configuration
void   mqtt_set_broker(const String& host, uint16_t port);
void   mqtt_set_credentials(const String& user, const String& pass);
void   mqtt_save_config();
void   mqtt_load_config();

// Stats
uint32_t mqtt_get_messages_sent();
uint32_t mqtt_get_messages_received();
unsigned long mqtt_get_last_publish_time();

// Publish all current sensor readings
void   mqtt_publish_all_sensors();

#endif // MQTT_HANDLER_H
