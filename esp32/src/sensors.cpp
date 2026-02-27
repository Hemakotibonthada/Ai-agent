// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Sensor Management Implementation
// ============================================================

#include "sensors.h"
#include "config.h"
#include "utils.h"
#include <DHT.h>

// ---- DHT Sensor ----
static DHT g_dht(PIN_DHT22, DHT22);

// ---- Moving Average Buffers ----
static float g_temp_buf[MOVING_AVG_SIZE];
static float g_hum_buf[MOVING_AVG_SIZE];
static int   g_air_buf[MOVING_AVG_SIZE];
static int   g_gas_buf[MOVING_AVG_SIZE];
static float g_water_buf[MOVING_AVG_SIZE];
static int   g_buf_index = 0;
static int   g_buf_count = 0;

// ---- Timing ----
static unsigned long g_last_dht    = 0;
static unsigned long g_last_air    = 0;
static unsigned long g_last_gas    = 0;
static unsigned long g_last_water  = 0;
static unsigned long g_last_motion = 0;
static unsigned long g_last_door   = 0;
static unsigned long g_boot_time   = 0;
static const unsigned long MQ_WARMUP_MS = 120000; // 2 minutes warmup

// ---- Current Data ----
static SensorData g_data = {};

// ---- PIR debounce ----
static bool g_last_pir_state = false;
static unsigned long g_last_pir_change = 0;
static const unsigned long PIR_DEBOUNCE_MS = 2000;

// ---- Calibration values ----
static float g_mq135_r0 = MQ135_R0;
static float g_mq2_threshold = MQ2_THRESHOLD;

// ---- Helper: moving average ----
static float moving_avg_f(float* buf, int count) {
    if (count == 0) return 0;
    int n = min(count, MOVING_AVG_SIZE);
    float sum = 0;
    for (int i = 0; i < n; i++) sum += buf[i];
    return sum / n;
}

static int moving_avg_i(int* buf, int count) {
    if (count == 0) return 0;
    int n = min(count, MOVING_AVG_SIZE);
    long sum = 0;
    for (int i = 0; i < n; i++) sum += buf[i];
    return (int)(sum / n);
}

// ---- HC-SR04 distance measurement ----
static float ultrasonic_read_cm() {
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

    long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000); // 30ms timeout
    if (duration == 0) return -1.0f; // Error / out of range

    float distance = (duration * 0.0343f) / 2.0f;
    return distance;
}

// ---- MQ-135 PPM Estimation ----
static float mq135_calc_ppm(int raw_adc) {
    if (raw_adc == 0) return 0;
    float sensor_voltage = (raw_adc / 4095.0f) * 3.3f;
    float rs = ((3.3f * 10.0f) / sensor_voltage) - 10.0f; // 10k load resistor
    float ratio = rs / g_mq135_r0;
    // Approximation for CO2 from datasheet curve
    float ppm = 116.6020682f * pow(ratio, -2.769034857f);
    return ppm;
}

// ---- SCT-013 Current Measurement (RMS) ----
static float read_current_rms() {
    const int SAMPLES = 200;
    const float ADC_MAX = 4095.0f;
    const float VREF = 3.3f;
    const float MID_POINT = ADC_MAX / 2.0f;

    float sum_sq = 0;
    for (int i = 0; i < SAMPLES; i++) {
        int raw = analogRead(PIN_SCT013);
        float centered = (float)raw - MID_POINT;
        float voltage = (centered / ADC_MAX) * VREF;
        float current = voltage * SCT013_CALIBRATION;
        sum_sq += current * current;
        delayMicroseconds(200); // ~50Hz: one cycle = 20ms, 200 samples * 200us = 40ms = 2 cycles
    }

    float rms = sqrt(sum_sq / SAMPLES);
    return rms;
}

// ============================================================
// Init
// ============================================================
void sensors_init() {
    // DHT22
    g_dht.begin();

    // MQ sensors (analog inputs)
    analogSetAttenuation(ADC_11db);
    pinMode(PIN_MQ135, INPUT);
    pinMode(PIN_MQ2, INPUT);

    // Ultrasonic
    pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
    pinMode(PIN_ULTRASONIC_ECHO, INPUT);

    // PIR
    pinMode(PIN_PIR, INPUT);

    // Current sensor
    pinMode(PIN_SCT013, INPUT);

    // Reed switches (pull-up)
    pinMode(PIN_DOOR_SENSOR_1, INPUT_PULLUP);
    pinMode(PIN_DOOR_SENSOR_2, INPUT_PULLUP);

    // Init buffers
    memset(g_temp_buf, 0, sizeof(g_temp_buf));
    memset(g_hum_buf, 0, sizeof(g_hum_buf));
    memset(g_air_buf, 0, sizeof(g_air_buf));
    memset(g_gas_buf, 0, sizeof(g_gas_buf));
    memset(g_water_buf, 0, sizeof(g_water_buf));

    g_boot_time = millis();
    memset(&g_data, 0, sizeof(g_data));

    LOG_I("SENS", "Sensors initialized. MQ warm-up: %lu sec", MQ_WARMUP_MS / 1000);
}

// ============================================================
// Loop
// ============================================================
void sensors_loop() {
    unsigned long now = millis();
    int idx = g_buf_index % MOVING_AVG_SIZE;

    // ---- DHT22: Temperature & Humidity ----
    if (now - g_last_dht >= INTERVAL_DHT) {
        g_last_dht = now;
        float t = g_dht.readTemperature();
        float h = g_dht.readHumidity();

        if (!isnan(t) && !isnan(h)) {
            t += DHT_TEMP_OFFSET;
            h += DHT_HUMIDITY_OFFSET;
            g_temp_buf[idx] = t;
            g_hum_buf[idx] = h;
            g_data.temperature = moving_avg_f(g_temp_buf, g_buf_count + 1);
            g_data.humidity    = moving_avg_f(g_hum_buf, g_buf_count + 1);
        } else {
            LOG_W("SENS", "DHT22 read error");
        }
    }

    // ---- MQ-135: Air Quality ----
    if (now - g_last_air >= INTERVAL_AIR) {
        g_last_air = now;
        int raw = analogRead(PIN_MQ135);
        g_air_buf[idx] = raw;
        g_data.air_quality_raw = moving_avg_i(g_air_buf, g_buf_count + 1);

        if (sensors_is_warmed_up()) {
            g_data.air_quality_ppm = mq135_calc_ppm(g_data.air_quality_raw);
        }
    }

    // ---- MQ-2: Gas Leak ----
    if (now - g_last_gas >= INTERVAL_GAS) {
        g_last_gas = now;
        int raw = analogRead(PIN_MQ2);
        g_gas_buf[idx] = raw;
        g_data.gas_raw = moving_avg_i(g_gas_buf, g_buf_count + 1);

        bool prev_leak = g_data.gas_leak_detected;
        g_data.gas_leak_detected = (g_data.gas_raw > g_mq2_threshold) && sensors_is_warmed_up();

        if (g_data.gas_leak_detected && !prev_leak) {
            LOG_E("SENS", "GAS LEAK DETECTED! Raw: %d, Threshold: %d", g_data.gas_raw, (int)g_mq2_threshold);
        }
    }

    // ---- HC-SR04: Water Level ----
    if (now - g_last_water >= INTERVAL_WATER) {
        g_last_water = now;
        float dist = ultrasonic_read_cm();
        if (dist > 0 && dist < 400) {
            g_water_buf[idx] = dist;
            float avg_dist = moving_avg_f(g_water_buf, g_buf_count + 1);
            g_data.water_level_cm = WATER_TANK_HEIGHT_CM - avg_dist + WATER_TANK_EMPTY_CM;
            if (g_data.water_level_cm < 0) g_data.water_level_cm = 0;
            if (g_data.water_level_cm > WATER_TANK_HEIGHT_CM) g_data.water_level_cm = WATER_TANK_HEIGHT_CM;
            g_data.water_level_pct = (g_data.water_level_cm / WATER_TANK_HEIGHT_CM) * 100.0f;
        }
    }

    // ---- PIR: Motion Detection ----
    if (now - g_last_motion >= INTERVAL_MOTION) {
        g_last_motion = now;
        bool pir = digitalRead(PIN_PIR) == HIGH;

        // Debounce
        if (pir != g_last_pir_state) {
            if (now - g_last_pir_change >= PIR_DEBOUNCE_MS) {
                g_last_pir_state = pir;
                g_last_pir_change = now;
                g_data.motion_detected = pir;
                if (pir) {
                    g_data.last_motion_time = now;
                    LOG_I("SENS", "Motion detected!");
                }
            }
        }
    }

    // ---- Reed Switches: Door/Window ----
    if (now - g_last_door >= INTERVAL_DOOR) {
        g_last_door = now;
        // Reed switch: LOW = closed (magnet near), HIGH = open
        g_data.door1_open = (digitalRead(PIN_DOOR_SENSOR_1) == HIGH);
        g_data.door2_open = (digitalRead(PIN_DOOR_SENSOR_2) == HIGH);
    }

    // ---- SCT-013: Current (handled by power_monitor) ----
    // power_monitor reads current directly

    // Update buffer index
    g_buf_index++;
    if (g_buf_count < MOVING_AVG_SIZE) g_buf_count++;

    g_data.last_update = now;
}

// ============================================================
// Getters
// ============================================================
SensorData sensors_get_data() {
    return g_data;
}

void sensors_get_json(JsonDocument& doc) {
    doc["temperature"]   = serialized(float_to_string(g_data.temperature, 1));
    doc["humidity"]       = serialized(float_to_string(g_data.humidity, 1));
    doc["air_quality"]    = g_data.air_quality_raw;
    doc["air_quality_ppm"]= serialized(float_to_string(g_data.air_quality_ppm, 0));
    doc["gas_raw"]        = g_data.gas_raw;
    doc["gas_leak"]       = g_data.gas_leak_detected;
    doc["water_level_cm"] = serialized(float_to_string(g_data.water_level_cm, 1));
    doc["water_level_pct"]= serialized(float_to_string(g_data.water_level_pct, 1));
    doc["motion"]         = g_data.motion_detected;
    doc["door1"]          = g_data.door1_open ? "open" : "closed";
    doc["door2"]          = g_data.door2_open ? "open" : "closed";
    doc["mq_warmed_up"]   = sensors_is_warmed_up();
    doc["device"]         = DEVICE_ID;
    doc["timestamp"]      = get_timestamp();
}

String sensors_get_json_string() {
    JsonDocument doc;
    sensors_get_json(doc);
    String output;
    serializeJson(doc, output);
    return output;
}

// ============================================================
// Individual Sensor Reads
// ============================================================
float sensor_read_temperature()      { return g_data.temperature; }
float sensor_read_humidity()         { return g_data.humidity; }
int   sensor_read_air_quality_raw()  { return g_data.air_quality_raw; }
float sensor_read_air_quality_ppm()  { return g_data.air_quality_ppm; }
int   sensor_read_gas_raw()          { return g_data.gas_raw; }
bool  sensor_is_gas_leak()           { return g_data.gas_leak_detected; }
float sensor_read_water_level_cm()   { return g_data.water_level_cm; }
float sensor_read_water_level_pct()  { return g_data.water_level_pct; }
float sensor_read_current()          { return read_current_rms(); }
float sensor_read_power()            { return read_current_rms() * VOLTAGE_SUPPLY; }
bool  sensor_read_motion()           { return g_data.motion_detected; }

bool sensor_read_door(int channel) {
    switch (channel) {
        case 0: return g_data.door1_open;
        case 1: return g_data.door2_open;
        default: return false;
    }
}

// ============================================================
// Calibration
// ============================================================
void sensor_calibrate_mq135() {
    LOG_I("SENS", "Calibrating MQ-135... Ensure clean air environment.");
    float sum = 0;
    const int SAMPLES = 50;
    for (int i = 0; i < SAMPLES; i++) {
        int raw = analogRead(PIN_MQ135);
        float voltage = (raw / 4095.0f) * 3.3f;
        float rs = ((3.3f * 10.0f) / voltage) - 10.0f;
        sum += rs;
        delay(100);
    }
    g_mq135_r0 = sum / SAMPLES;
    prefs_save_float("mq135_r0", g_mq135_r0);
    LOG_I("SENS", "MQ-135 calibrated. R0 = %.2f", g_mq135_r0);
}

void sensor_calibrate_mq2() {
    LOG_I("SENS", "Calibrating MQ-2... Ensure clean air environment.");
    float sum = 0;
    const int SAMPLES = 50;
    for (int i = 0; i < SAMPLES; i++) {
        sum += analogRead(PIN_MQ2);
        delay(100);
    }
    float baseline = sum / SAMPLES;
    g_mq2_threshold = baseline * 1.5f; // 50% above baseline
    prefs_save_float("mq2_thr", g_mq2_threshold);
    LOG_I("SENS", "MQ-2 calibrated. Threshold = %.0f", g_mq2_threshold);
}

void sensor_calibrate_current(float known_current) {
    float measured = read_current_rms();
    if (measured > 0.01f) {
        float new_cal = SCT013_CALIBRATION * (known_current / measured);
        prefs_save_float("sct_cal", new_cal);
        LOG_I("SENS", "Current sensor calibrated. Factor = %.2f", new_cal);
    }
}

// ============================================================
// Warm-up Check
// ============================================================
bool sensors_is_warmed_up() {
    return (millis() - g_boot_time) >= MQ_WARMUP_MS;
}
