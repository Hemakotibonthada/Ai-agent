#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Power Monitor Header
// ============================================================

#ifndef POWER_MONITOR_H
#define POWER_MONITOR_H

#include <Arduino.h>
#include <ArduinoJson.h>

struct PowerData {
    float current_rms;       // Amps
    float voltage;           // Volts (configured)
    float power_watts;       // Watts
    float energy_kwh;        // kWh accumulated
    float daily_kwh;         // Today's usage
    float monthly_kwh;       // This month's usage
    float daily_cost;        // Today's cost
    float monthly_cost;      // This month's cost
    float power_factor;      // Estimated PF
    bool  anomaly_detected;  // Spike detection
    float peak_watts;        // Peak power recorded
    unsigned long last_read; // Last reading time
};

void       power_init();
void       power_loop();
PowerData  power_get_data();
void       power_get_json(JsonDocument& doc);
String     power_get_json_string();

// Readings
float      power_read_current_rms();
float      power_get_watts();
float      power_get_kwh_total();
float      power_get_kwh_daily();
float      power_get_kwh_monthly();
float      power_get_cost_daily();
float      power_get_cost_monthly();

// Calibration
void       power_set_calibration(float factor);
void       power_set_voltage(float voltage);
void       power_set_tariff(float cost_per_kwh);
void       power_reset_daily();
void       power_reset_monthly();

// Persistence
void       power_save_data();
void       power_load_data();

// Anomaly detection
bool       power_check_anomaly();
float      power_get_peak();

#endif // POWER_MONITOR_H
