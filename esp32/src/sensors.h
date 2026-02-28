#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Sensors Header — Enhanced v2.0
// Median filter, outlier rejection, sensor health, min/max
// ============================================================

#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"

// Sensor health status
enum SensorHealth {
    SENSOR_OK = 0,
    SENSOR_DEGRADED,      // Intermittent failures
    SENSOR_FAILED,        // Consistently failing
    SENSOR_WARMING_UP,    // Gas sensors warming
    SENSOR_NOT_PRESENT    // Not detected
};

// Min/Max tracking per sensor per day
struct SensorMinMax {
    float temp_min,  temp_max;
    float hum_min,   hum_max;
    float aqi_min,   aqi_max;
    float water_min, water_max;
    float power_min, power_max;
    uint32_t day_epoch;  // Day boundary
};

// Sensor data structure — Enhanced
struct SensorData {
    // Temperature & Humidity
    float temperature;
    float humidity;

    // Air Quality
    int   air_quality_raw;
    float air_quality_ppm;

    // Gas
    int   gas_raw;
    bool  gas_leak_detected;

    // Water Level
    float water_level_cm;
    float water_level_pct;

    // Current/Power (from power monitor)
    float current_amps;
    float power_watts;

    // Motion
    bool  motion_detected;
    unsigned long last_motion_time;
    uint32_t motion_count_today;

    // Door/Window
    bool  door1_open;
    bool  door2_open;

    // Metadata
    unsigned long last_update;

    // v2.0: Sensor health
    SensorHealth health_dht;
    SensorHealth health_mq135;
    SensorHealth health_mq2;
    SensorHealth health_ultrasonic;

    // v2.0: Consecutive failure counts
    uint8_t fail_count_dht;
    uint8_t fail_count_ultrasonic;

    // v2.0: MQ warm-up progress (0-100%)
    uint8_t mq_warmup_pct;
};

// ---- Core functions ----
void        sensors_init();
void        sensors_loop();
SensorData  sensors_get_data();
void        sensors_get_json(JsonDocument& doc);
String      sensors_get_json_string();

// ---- Individual sensor reads ----
float       sensor_read_temperature();
float       sensor_read_humidity();
int         sensor_read_air_quality_raw();
float       sensor_read_air_quality_ppm();
int         sensor_read_gas_raw();
bool        sensor_is_gas_leak();
float       sensor_read_water_level_cm();
float       sensor_read_water_level_pct();
float       sensor_read_current();
float       sensor_read_power();
bool        sensor_read_motion();
bool        sensor_read_door(int channel);

// ---- Calibration ----
void        sensor_calibrate_mq135();
void        sensor_calibrate_mq2();
void        sensor_calibrate_current(float known_current);

// ---- Health & Status ----
bool        sensors_is_warmed_up();
SensorHealth sensors_get_health(const char* sensor_name);
String      sensors_get_health_json();

// ---- Min/Max tracking ----
SensorMinMax sensors_get_min_max();
void        sensors_reset_min_max();

#endif // SENSORS_H
