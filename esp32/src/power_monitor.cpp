// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Power Monitor Implementation
// ============================================================

#include "power_monitor.h"
#include "config.h"
#include "utils.h"

// ---- State ----
static PowerData g_power = {};
static float g_calibration = SCT013_CALIBRATION;
static float g_voltage     = VOLTAGE_SUPPLY;
static float g_tariff      = POWER_COST_PER_KWH;

static unsigned long g_last_read       = 0;
static unsigned long g_last_save       = 0;
static unsigned long g_last_kwh_update = 0;
static unsigned long g_day_start_ms    = 0;
static int g_current_day   = -1;
static int g_current_month = -1;

// Anomaly detection
static float g_power_history[20];
static int   g_power_hist_idx = 0;
static int   g_power_hist_count = 0;

static const unsigned long SAVE_INTERVAL = 300000; // 5 min

// ---- Read current RMS ----
static float read_current_rms_internal() {
    const int SAMPLES = 200;
    const float ADC_MAX = 4095.0f;
    const float VREF = 3.3f;
    const float MID_POINT = ADC_MAX / 2.0f;

    float sum_sq = 0;
    for (int i = 0; i < SAMPLES; i++) {
        int raw = analogRead(PIN_SCT013);
        float centered = (float)raw - MID_POINT;
        float voltage = (centered / ADC_MAX) * VREF;
        float current = voltage * g_calibration;
        sum_sq += current * current;
        delayMicroseconds(200);
    }

    float rms = sqrt(sum_sq / SAMPLES);
    // Filter out noise floor
    if (rms < 0.05f) rms = 0.0f;
    return rms;
}

// ---- Estimate power factor from waveform shape ----
static float estimate_power_factor() {
    // Simplified estimation: measure phase shift by sampling
    // For a basic implementation, assume near-unity PF for resistive loads
    const int SAMPLES = 100;
    int zero_crossings = 0;
    int prev_sign = 0;
    float MID = 4095.0f / 2.0f;

    for (int i = 0; i < SAMPLES; i++) {
        int raw = analogRead(PIN_SCT013);
        int sign = (raw > MID) ? 1 : -1;
        if (prev_sign != 0 && sign != prev_sign) {
            zero_crossings++;
        }
        prev_sign = sign;
        delayMicroseconds(200);
    }

    // With 50Hz AC over ~20ms, we expect ~2 zero crossings per cycle
    // More crossings relative to expected = more distortion = lower PF
    float expected = (SAMPLES * 200e-6f) / (1.0f / 50.0f) * 2.0f;
    if (expected < 1) expected = 1;
    float ratio = (float)zero_crossings / expected;
    float pf = constrain(ratio, 0.5f, 1.0f);

    return pf;
}

// ---- Check day/month rollover ----
static void check_day_rollover() {
    unsigned long epoch = get_epoch_time();
    if (epoch < 1000000) return; // NTP not synced yet

    struct tm* t = gmtime((time_t*)&epoch);
    int day = t->tm_mday;
    int month = t->tm_mon;

    if (g_current_day < 0) {
        g_current_day = day;
        g_current_month = month;
        return;
    }

    if (day != g_current_day) {
        LOG_I("PWR", "Day rollover. Yesterday: %.3f kWh, $%.2f", g_power.daily_kwh, g_power.daily_cost);
        // Save yesterday's data
        prefs_save_float("pwr_yd_kwh", g_power.daily_kwh);
        g_power.daily_kwh = 0;
        g_power.daily_cost = 0;
        g_current_day = day;
    }

    if (month != g_current_month) {
        LOG_I("PWR", "Month rollover. Last month: %.3f kWh, $%.2f", g_power.monthly_kwh, g_power.monthly_cost);
        prefs_save_float("pwr_lm_kwh", g_power.monthly_kwh);
        g_power.monthly_kwh = 0;
        g_power.monthly_cost = 0;
        g_current_month = month;
    }
}

// ============================================================
// Init
// ============================================================
void power_init() {
    analogSetAttenuation(ADC_11db);
    pinMode(PIN_SCT013, INPUT);

    // Load persisted data
    power_load_data();

    g_last_kwh_update = millis();
    g_power.voltage = g_voltage;

    LOG_I("PWR", "Power monitor initialized. Calibration: %.2f, Voltage: %.0fV, Tariff: $%.3f/kWh",
           g_calibration, g_voltage, g_tariff);
}

// ============================================================
// Loop
// ============================================================
void power_loop() {
    unsigned long now = millis();

    // Read current at specified interval
    if (now - g_last_read >= INTERVAL_POWER) {
        g_last_read = now;

        // Read RMS current
        g_power.current_rms = read_current_rms_internal();
        g_power.voltage = g_voltage;
        g_power.power_factor = estimate_power_factor();

        // Calculate power
        g_power.power_watts = g_power.current_rms * g_power.voltage * g_power.power_factor;

        // Track peak
        if (g_power.power_watts > g_power.peak_watts) {
            g_power.peak_watts = g_power.power_watts;
        }

        // Accumulate energy (kWh)
        unsigned long elapsed_ms = now - g_last_kwh_update;
        g_last_kwh_update = now;
        float hours = elapsed_ms / 3600000.0f;
        float kwh_increment = (g_power.power_watts / 1000.0f) * hours;

        g_power.energy_kwh  += kwh_increment;
        g_power.daily_kwh   += kwh_increment;
        g_power.monthly_kwh += kwh_increment;
        g_power.daily_cost   = g_power.daily_kwh * g_tariff;
        g_power.monthly_cost = g_power.monthly_kwh * g_tariff;

        // Anomaly detection
        g_power_history[g_power_hist_idx % 20] = g_power.power_watts;
        g_power_hist_idx++;
        if (g_power_hist_count < 20) g_power_hist_count++;
        g_power.anomaly_detected = power_check_anomaly();

        if (g_power.anomaly_detected) {
            LOG_W("PWR", "Power anomaly detected! Current: %.1fW, Threshold: %.1fW",
                   g_power.power_watts, POWER_SPIKE_WATTS);
        }

        g_power.last_read = now;
    }

    // Day/month rollover check
    check_day_rollover();

    // Periodic save
    if (now - g_last_save >= SAVE_INTERVAL) {
        g_last_save = now;
        power_save_data();
    }
}

// ============================================================
// Getters
// ============================================================
PowerData power_get_data() {
    return g_power;
}

void power_get_json(JsonDocument& doc) {
    doc["current_amps"]  = serialized(float_to_string(g_power.current_rms, 3));
    doc["voltage"]       = g_power.voltage;
    doc["power_watts"]   = serialized(float_to_string(g_power.power_watts, 1));
    doc["power_factor"]  = serialized(float_to_string(g_power.power_factor, 2));
    doc["energy_kwh"]    = serialized(float_to_string(g_power.energy_kwh, 3));
    doc["daily_kwh"]     = serialized(float_to_string(g_power.daily_kwh, 3));
    doc["monthly_kwh"]   = serialized(float_to_string(g_power.monthly_kwh, 3));
    doc["daily_cost"]    = serialized(float_to_string(g_power.daily_cost, 2));
    doc["monthly_cost"]  = serialized(float_to_string(g_power.monthly_cost, 2));
    doc["peak_watts"]    = serialized(float_to_string(g_power.peak_watts, 1));
    doc["anomaly"]       = g_power.anomaly_detected;
    doc["device"]        = DEVICE_ID;
    doc["timestamp"]     = get_timestamp();
}

String power_get_json_string() {
    JsonDocument doc;
    power_get_json(doc);
    String output;
    serializeJson(doc, output);
    return output;
}

float power_read_current_rms() { return g_power.current_rms; }
float power_get_watts()        { return g_power.power_watts; }
float power_get_kwh_total()    { return g_power.energy_kwh; }
float power_get_kwh_daily()    { return g_power.daily_kwh; }
float power_get_kwh_monthly()  { return g_power.monthly_kwh; }
float power_get_cost_daily()   { return g_power.daily_cost; }
float power_get_cost_monthly() { return g_power.monthly_cost; }

// ============================================================
// Calibration & Configuration
// ============================================================
void power_set_calibration(float factor) {
    g_calibration = factor;
    prefs_save_float("pwr_cal", g_calibration);
    LOG_I("PWR", "Calibration set: %.2f", g_calibration);
}

void power_set_voltage(float voltage) {
    g_voltage = voltage;
    g_power.voltage = voltage;
    prefs_save_float("pwr_volt", g_voltage);
    LOG_I("PWR", "Voltage set: %.0fV", g_voltage);
}

void power_set_tariff(float cost_per_kwh) {
    g_tariff = cost_per_kwh;
    prefs_save_float("pwr_tariff", g_tariff);
    LOG_I("PWR", "Tariff set: $%.3f/kWh", g_tariff);
}

void power_reset_daily() {
    g_power.daily_kwh = 0;
    g_power.daily_cost = 0;
    LOG_I("PWR", "Daily counters reset");
}

void power_reset_monthly() {
    g_power.monthly_kwh = 0;
    g_power.monthly_cost = 0;
    LOG_I("PWR", "Monthly counters reset");
}

// ============================================================
// Persistence
// ============================================================
void power_save_data() {
    prefs_save_float("pwr_kwh", g_power.energy_kwh);
    prefs_save_float("pwr_d_kwh", g_power.daily_kwh);
    prefs_save_float("pwr_m_kwh", g_power.monthly_kwh);
    prefs_save_float("pwr_peak", g_power.peak_watts);
    LOG_D("PWR", "Data saved. Total: %.3f kWh", g_power.energy_kwh);
}

void power_load_data() {
    g_calibration          = prefs_get_float("pwr_cal", SCT013_CALIBRATION);
    g_voltage              = prefs_get_float("pwr_volt", VOLTAGE_SUPPLY);
    g_tariff               = prefs_get_float("pwr_tariff", POWER_COST_PER_KWH);
    g_power.energy_kwh     = prefs_get_float("pwr_kwh", 0);
    g_power.daily_kwh      = prefs_get_float("pwr_d_kwh", 0);
    g_power.monthly_kwh    = prefs_get_float("pwr_m_kwh", 0);
    g_power.peak_watts     = prefs_get_float("pwr_peak", 0);
    g_power.daily_cost     = g_power.daily_kwh * g_tariff;
    g_power.monthly_cost   = g_power.monthly_kwh * g_tariff;
    LOG_I("PWR", "Loaded: %.3f kWh total, %.3f kWh today", g_power.energy_kwh, g_power.daily_kwh);
}

// ============================================================
// Anomaly Detection
// ============================================================
bool power_check_anomaly() {
    // Method 1: Absolute threshold
    if (g_power.power_watts > POWER_SPIKE_WATTS) return true;

    // Method 2: Statistical deviation
    if (g_power_hist_count < 5) return false;

    // Calculate mean and std dev of recent readings
    float sum = 0;
    int n = min(g_power_hist_count, 20);
    for (int i = 0; i < n; i++) sum += g_power_history[i];
    float mean = sum / n;

    float var_sum = 0;
    for (int i = 0; i < n; i++) {
        float diff = g_power_history[i] - mean;
        var_sum += diff * diff;
    }
    float stddev = sqrt(var_sum / n);

    // Flag if current reading is > 3 std devs from mean
    if (stddev > 10 && g_power.power_watts > (mean + 3 * stddev)) {
        return true;
    }

    return false;
}

float power_get_peak() {
    return g_power.peak_watts;
}
