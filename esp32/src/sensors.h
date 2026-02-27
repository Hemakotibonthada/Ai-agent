#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Sensors Header
// ============================================================

#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <ArduinoJson.h>

// Sensor data structure
struct SensorData {
    float temperature;
    float humidity;
    int   air_quality_raw;
    float air_quality_ppm;
    int   gas_raw;
    bool  gas_leak_detected;
    float water_level_cm;
    float water_level_pct;
    float current_amps;
    float power_watts;
    bool  motion_detected;
    bool  door1_open;
    bool  door2_open;
    unsigned long last_motion_time;
    unsigned long last_update;
};

void        sensors_init();
void        sensors_loop();
SensorData  sensors_get_data();
void        sensors_get_json(JsonDocument& doc);
String      sensors_get_json_string();

// Individual sensor reads
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

// Calibration
void        sensor_calibrate_mq135();
void        sensor_calibrate_mq2();
void        sensor_calibrate_current(float known_current);

// Internal helpers
bool        sensors_is_warmed_up();

#endif // SENSORS_H
