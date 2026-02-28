// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Sensor Management Implementation — Enhanced v2.0
// Median filter, outlier rejection, sensor health, min/max
// ============================================================

#include "sensors.h"
#include "config.h"
#include "utils.h"
#include <DHT.h>
#include <algorithm>

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

// ---- Median Filter Buffers (v2.0) ----
static float g_temp_median[MEDIAN_FILTER_SIZE];
static float g_hum_median[MEDIAN_FILTER_SIZE];
static float g_water_median[MEDIAN_FILTER_SIZE];
static int   g_med_idx = 0;
static int   g_med_count = 0;

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

// ---- Min/Max Tracking (v2.0) ----
static SensorMinMax g_min_max = {};
static bool g_min_max_initialized = false;

// ---- PIR debounce ----
static bool g_last_pir_state = false;
static unsigned long g_last_pir_change = 0;
static const unsigned long PIR_DEBOUNCE_MS = 2000;

// ---- Calibration values ----
static float g_mq135_r0 = MQ135_R0;
static float g_mq2_threshold = MQ2_THRESHOLD;

// ============================================================
// Helper: Moving Average
// ============================================================
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

// ============================================================
// Helper: Median Filter (v2.0)
// ============================================================
static float median_filter(float* buf, int count) {
    if (count == 0) return 0;
    int n = min(count, MEDIAN_FILTER_SIZE);

    // Copy and sort
    float sorted[MEDIAN_FILTER_SIZE];
    memcpy(sorted, buf, n * sizeof(float));
    std::sort(sorted, sorted + n);

    return sorted[n / 2];  // Return middle value
}

// ============================================================
// Helper: Outlier Rejection (v2.0)
// Returns true if value is an outlier (> SIGMA standard deviations from mean)
// ============================================================
static bool is_outlier(float value, float* buf, int count) {
    if (count < 3) return false;  // Need enough samples
    int n = min(count, MOVING_AVG_SIZE);

    float mean = moving_avg_f(buf, count);
    float sum_sq = 0;
    for (int i = 0; i < n; i++) {
        float diff = buf[i] - mean;
        sum_sq += diff * diff;
    }
    float stddev = sqrt(sum_sq / n);
    if (stddev < 0.01f) return false;  // Avoid division by near-zero

    return fabs(value - mean) > (SENSOR_OUTLIER_SIGMA * stddev);
}

// ============================================================
// Helper: Update Min/Max (v2.0)
// ============================================================
static void update_min_max() {
    if (!g_min_max_initialized) {
        g_min_max.temp_min  = g_data.temperature;
        g_min_max.temp_max  = g_data.temperature;
        g_min_max.hum_min   = g_data.humidity;
        g_min_max.hum_max   = g_data.humidity;
        g_min_max.aqi_min   = g_data.air_quality_ppm;
        g_min_max.aqi_max   = g_data.air_quality_ppm;
        g_min_max.water_min = g_data.water_level_pct;
        g_min_max.water_max = g_data.water_level_pct;
        g_min_max.power_min = g_data.power_watts;
        g_min_max.power_max = g_data.power_watts;
        g_min_max_initialized = true;
        return;
    }

    if (g_data.temperature < g_min_max.temp_min)  g_min_max.temp_min  = g_data.temperature;
    if (g_data.temperature > g_min_max.temp_max)  g_min_max.temp_max  = g_data.temperature;
    if (g_data.humidity < g_min_max.hum_min)       g_min_max.hum_min   = g_data.humidity;
    if (g_data.humidity > g_min_max.hum_max)       g_min_max.hum_max   = g_data.humidity;
    if (g_data.air_quality_ppm < g_min_max.aqi_min) g_min_max.aqi_min = g_data.air_quality_ppm;
    if (g_data.air_quality_ppm > g_min_max.aqi_max) g_min_max.aqi_max = g_data.air_quality_ppm;
    if (g_data.water_level_pct < g_min_max.water_min) g_min_max.water_min = g_data.water_level_pct;
    if (g_data.water_level_pct > g_min_max.water_max) g_min_max.water_max = g_data.water_level_pct;
}

// ---- HC-SR04 distance measurement ----
static float ultrasonic_read_cm() {
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

    long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000);
    if (duration == 0) return -1.0f;

    float distance = (duration * 0.0343f) / 2.0f;
    return distance;
}

// ---- MQ-135 PPM Estimation ----
static float mq135_calc_ppm(int raw_adc) {
    if (raw_adc == 0) return 0;
    float sensor_voltage = (raw_adc / 4095.0f) * 3.3f;
    float rs = ((3.3f * 10.0f) / sensor_voltage) - 10.0f;
    float ratio = rs / g_mq135_r0;
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
        delayMicroseconds(200);
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
    memset(g_temp_median, 0, sizeof(g_temp_median));
    memset(g_hum_median, 0, sizeof(g_hum_median));
    memset(g_water_median, 0, sizeof(g_water_median));

    g_boot_time = millis();
    memset(&g_data, 0, sizeof(g_data));
    memset(&g_min_max, 0, sizeof(g_min_max));

    // Initialize health to OK / warming
    g_data.health_dht = SENSOR_OK;
    g_data.health_mq135 = SENSOR_WARMING_UP;
    g_data.health_mq2 = SENSOR_WARMING_UP;
    g_data.health_ultrasonic = SENSOR_OK;
    g_data.fail_count_dht = 0;
    g_data.fail_count_ultrasonic = 0;
    g_data.motion_count_today = 0;

    // Load calibration from NVS
    float saved_r0 = prefs_get_float("mq135_r0", 0);
    if (saved_r0 > 0) {
        g_mq135_r0 = saved_r0;
        LOG_I("SENS", "Loaded MQ-135 R0: %.2f", g_mq135_r0);
    }
    float saved_thr = prefs_get_float("mq2_thr", 0);
    if (saved_thr > 0) {
        g_mq2_threshold = saved_thr;
        LOG_I("SENS", "Loaded MQ-2 threshold: %.0f", g_mq2_threshold);
    }

    LOG_I("SENS", "Sensors v2.0 initialized. Median filter: %d, Outlier sigma: %.1f",
          MEDIAN_FILTER_SIZE, SENSOR_OUTLIER_SIGMA);
    LOG_I("SENS", "MQ warm-up: %lu sec", MQ_WARMUP_MS / 1000);
}

// ============================================================
// Loop
// ============================================================
void sensors_loop() {
    unsigned long now = millis();
    int idx = g_buf_index % MOVING_AVG_SIZE;
    int med_idx = g_med_idx % MEDIAN_FILTER_SIZE;

    // ---- Update MQ warm-up progress ----
    unsigned long elapsed = now - g_boot_time;
    if (elapsed < MQ_WARMUP_MS) {
        g_data.mq_warmup_pct = (uint8_t)((elapsed * 100) / MQ_WARMUP_MS);
    } else {
        g_data.mq_warmup_pct = 100;
        if (g_data.health_mq135 == SENSOR_WARMING_UP) g_data.health_mq135 = SENSOR_OK;
        if (g_data.health_mq2 == SENSOR_WARMING_UP) g_data.health_mq2 = SENSOR_OK;
    }

    // ---- DHT22: Temperature & Humidity ----
    if (now - g_last_dht >= INTERVAL_DHT) {
        g_last_dht = now;
        float t = g_dht.readTemperature();
        float h = g_dht.readHumidity();

        if (!isnan(t) && !isnan(h)) {
            t += DHT_TEMP_OFFSET;
            h += DHT_HUMIDITY_OFFSET;

            // Outlier rejection
            if (!is_outlier(t, g_temp_buf, g_buf_count)) {
                g_temp_buf[idx] = t;
                g_temp_median[med_idx] = t;
                g_data.temperature = median_filter(g_temp_median, min(g_med_count + 1, MEDIAN_FILTER_SIZE));
            } else {
                LOG_D("SENS", "DHT temp outlier rejected: %.1f (avg: %.1f)", t,
                      moving_avg_f(g_temp_buf, g_buf_count));
            }

            if (!is_outlier(h, g_hum_buf, g_buf_count)) {
                g_hum_buf[idx] = h;
                g_hum_median[med_idx] = h;
                g_data.humidity = median_filter(g_hum_median, min(g_med_count + 1, MEDIAN_FILTER_SIZE));
            }

            g_data.fail_count_dht = 0;
            g_data.health_dht = SENSOR_OK;
        } else {
            g_data.fail_count_dht++;
            if (g_data.fail_count_dht >= SENSOR_FAIL_COUNT_MAX) {
                g_data.health_dht = SENSOR_FAILED;
                LOG_E("SENS", "DHT22 FAILED after %d consecutive errors", g_data.fail_count_dht);
            } else if (g_data.fail_count_dht >= 3) {
                g_data.health_dht = SENSOR_DEGRADED;
                LOG_W("SENS", "DHT22 degraded (%d failures)", g_data.fail_count_dht);
            }
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
            // Outlier rejection for ultrasonic
            if (!is_outlier(dist, g_water_buf, g_buf_count)) {
                g_water_buf[idx] = dist;
                g_water_median[med_idx] = dist;

                float filtered = median_filter(g_water_median, min(g_med_count + 1, MEDIAN_FILTER_SIZE));
                g_data.water_level_cm = WATER_TANK_HEIGHT_CM - filtered + WATER_TANK_EMPTY_CM;
                if (g_data.water_level_cm < 0) g_data.water_level_cm = 0;
                if (g_data.water_level_cm > WATER_TANK_HEIGHT_CM) g_data.water_level_cm = WATER_TANK_HEIGHT_CM;
                g_data.water_level_pct = (g_data.water_level_cm / WATER_TANK_HEIGHT_CM) * 100.0f;
            }

            g_data.fail_count_ultrasonic = 0;
            g_data.health_ultrasonic = SENSOR_OK;
        } else {
            g_data.fail_count_ultrasonic++;
            if (g_data.fail_count_ultrasonic >= SENSOR_FAIL_COUNT_MAX) {
                g_data.health_ultrasonic = SENSOR_FAILED;
            } else if (g_data.fail_count_ultrasonic >= 3) {
                g_data.health_ultrasonic = SENSOR_DEGRADED;
            }
        }
    }

    // ---- PIR: Motion Detection ----
    if (now - g_last_motion >= INTERVAL_MOTION) {
        g_last_motion = now;
        bool pir = digitalRead(PIN_PIR) == HIGH;

        if (pir != g_last_pir_state) {
            if (now - g_last_pir_change >= PIR_DEBOUNCE_MS) {
                g_last_pir_state = pir;
                g_last_pir_change = now;
                g_data.motion_detected = pir;
                if (pir) {
                    g_data.last_motion_time = now;
                    g_data.motion_count_today++;
                    LOG_I("SENS", "Motion detected! (count today: %u)", g_data.motion_count_today);
                }
            }
        }
    }

    // ---- Reed Switches: Door/Window ----
    if (now - g_last_door >= INTERVAL_DOOR) {
        g_last_door = now;
        g_data.door1_open = (digitalRead(PIN_DOOR_SENSOR_1) == HIGH);
        g_data.door2_open = (digitalRead(PIN_DOOR_SENSOR_2) == HIGH);
    }

    // Update buffer indices
    g_buf_index++;
    if (g_buf_count < MOVING_AVG_SIZE) g_buf_count++;
    g_med_idx++;
    if (g_med_count < MEDIAN_FILTER_SIZE) g_med_count++;

    g_data.last_update = now;

    // Update min/max tracking
    update_min_max();
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
    doc["motion_count"]   = g_data.motion_count_today;
    doc["door1"]          = g_data.door1_open ? "open" : "closed";
    doc["door2"]          = g_data.door2_open ? "open" : "closed";
    doc["mq_warmed_up"]   = sensors_is_warmed_up();
    doc["mq_warmup_pct"]  = g_data.mq_warmup_pct;
    doc["device"]         = DEVICE_ID;
    doc["timestamp"]      = get_timestamp();

    // v2.0: Sensor health
    JsonObject health = doc["health"].to<JsonObject>();
    health["dht22"]     = (int)g_data.health_dht;
    health["mq135"]     = (int)g_data.health_mq135;
    health["mq2"]       = (int)g_data.health_mq2;
    health["ultrasonic"]= (int)g_data.health_ultrasonic;

    // v2.0: Min/Max
    if (g_min_max_initialized) {
        JsonObject mm = doc["min_max"].to<JsonObject>();
        mm["temp_min"]  = serialized(float_to_string(g_min_max.temp_min, 1));
        mm["temp_max"]  = serialized(float_to_string(g_min_max.temp_max, 1));
        mm["hum_min"]   = serialized(float_to_string(g_min_max.hum_min, 1));
        mm["hum_max"]   = serialized(float_to_string(g_min_max.hum_max, 1));
        mm["water_min"] = serialized(float_to_string(g_min_max.water_min, 1));
        mm["water_max"] = serialized(float_to_string(g_min_max.water_max, 1));
    }
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
    g_mq2_threshold = baseline * 1.5f;
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
// Health & Status (v2.0)
// ============================================================
bool sensors_is_warmed_up() {
    return (millis() - g_boot_time) >= MQ_WARMUP_MS;
}

SensorHealth sensors_get_health(const char* sensor_name) {
    String name = String(sensor_name);
    if (name == "dht22" || name == "temperature" || name == "humidity")
        return g_data.health_dht;
    if (name == "mq135" || name == "air_quality")
        return g_data.health_mq135;
    if (name == "mq2" || name == "gas")
        return g_data.health_mq2;
    if (name == "ultrasonic" || name == "water")
        return g_data.health_ultrasonic;
    return SENSOR_NOT_PRESENT;
}

static const char* health_to_string(SensorHealth h) {
    switch (h) {
        case SENSOR_OK:          return "OK";
        case SENSOR_DEGRADED:    return "Degraded";
        case SENSOR_FAILED:      return "Failed";
        case SENSOR_WARMING_UP:  return "WarmingUp";
        case SENSOR_NOT_PRESENT: return "NotPresent";
        default:                 return "Unknown";
    }
}

String sensors_get_health_json() {
    JsonDocument doc;
    doc["dht22"]      = health_to_string(g_data.health_dht);
    doc["mq135"]      = health_to_string(g_data.health_mq135);
    doc["mq2"]        = health_to_string(g_data.health_mq2);
    doc["ultrasonic"]  = health_to_string(g_data.health_ultrasonic);
    doc["warmup_pct"]  = g_data.mq_warmup_pct;
    doc["dht_fails"]   = g_data.fail_count_dht;
    doc["ultra_fails"] = g_data.fail_count_ultrasonic;

    String output;
    serializeJson(doc, output);
    return output;
}

// ============================================================
// Min/Max Tracking (v2.0)
// ============================================================
SensorMinMax sensors_get_min_max() {
    return g_min_max;
}

void sensors_reset_min_max() {
    g_min_max_initialized = false;
    memset(&g_min_max, 0, sizeof(g_min_max));
    g_data.motion_count_today = 0;
    LOG_I("SENS", "Min/Max tracking reset");
}
