// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Actuators Implementation — Enhanced v2.0
// Relay protection, cycle counting, EEPROM state integration
// ============================================================

#include "actuators.h"
#include "config.h"
#include "utils.h"
#include "eeprom_manager.h"
#include <Adafruit_NeoPixel.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>

// ---- NeoPixel ----
static Adafruit_NeoPixel g_strip(NEOPIXEL_COUNT, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// ---- IR Sender ----
static IRsend g_ir(PIN_IR_LED);

// ---- Light State ----
static const int LIGHT_PINS[] = { PIN_RELAY_LIGHT1, PIN_RELAY_LIGHT2, PIN_RELAY_LIGHT3, PIN_RELAY_LIGHT4 };
static bool     g_light_state[MAX_LIGHTS] = { false, false, false, false };
static uint8_t  g_light_brightness[MAX_LIGHTS] = { 255, 255, 255, 255 };
static uint8_t  g_light_target_bri[MAX_LIGHTS] = { 255, 255, 255, 255 };

// ---- Fan State ----
static bool    g_fan_on = false;
static uint8_t g_fan_speed = 0;

// ---- AC State ----
static bool   g_ac_on = false;
static int    g_ac_temp = 24;
static String g_ac_mode = "cool";
static String g_ac_fan_speed = "auto";

// ---- Scene ----
static Scene g_active_scene = SCENE_NONE;

// ---- Relay Stats (v2.0) ----
static RelayStats g_relay_stats[5] = {};  // 0-3=lights, 4=fan

// ---- NeoPixel Animation ----
static unsigned long g_neo_last_update = 0;
static int g_neo_anim_step = 0;
static bool g_neo_animating = false;
enum NeoAnimation { NEO_NONE, NEO_BREATHING, NEO_RAINBOW, NEO_ALERT };
static NeoAnimation g_neo_anim = NEO_NONE;
static uint8_t g_neo_r = 0, g_neo_g = 0, g_neo_b = 0;

// ---- Buzzer ----
static unsigned long g_buzzer_end = 0;
static bool g_buzzer_pattern_active = false;
static int g_buzzer_pattern_step = 0;
static unsigned long g_buzzer_pattern_time = 0;
enum BuzzerPattern { BUZ_NONE, BUZ_GAS, BUZ_MOTION, BUZ_WATER };
static BuzzerPattern g_buzzer_pattern = BUZ_NONE;

// ---- PWM Light channels ----
static const int LIGHT_PWM_CHANNELS[] = { 1, 2, 3, 4 };

// ============================================================
// AC IR Protocol
// ============================================================
#define AC_IR_POWER   0x10AF8877UL
#define AC_IR_TEMP_UP 0x10AF708FUL
#define AC_IR_TEMP_DN 0x10AFB04FUL
#define AC_IR_MODE    0x10AF807FUL
#define AC_IR_FAN     0x10AF40BFUL
#define AC_IR_SWING   0x10AF906FUL

// ============================================================
// Internal: Relay Protection Check (v2.0)
// Prevents relay switching faster than RELAY_MIN_SWITCH_INTERVAL_MS
// ============================================================
static bool relay_can_switch(int relay_idx) {
    if (relay_idx < 0 || relay_idx > 4) return false;

    unsigned long now = millis();
    unsigned long elapsed = now - g_relay_stats[relay_idx].last_switch;

    if (elapsed < RELAY_MIN_SWITCH_INTERVAL_MS) {
        LOG_W("ACT", "Relay %d switch blocked — cooldown (%lu/%lu ms)",
              relay_idx, elapsed, (unsigned long)RELAY_MIN_SWITCH_INTERVAL_MS);
        return false;
    }

    if (g_relay_stats[relay_idx].daily_cycles >= RELAY_MAX_DAILY_CYCLES) {
        LOG_W("ACT", "Relay %d daily cycle limit reached (%u/%u)",
              relay_idx, g_relay_stats[relay_idx].daily_cycles, RELAY_MAX_DAILY_CYCLES);
        return false;
    }

    return true;
}

// Internal: Record relay switch (v2.0)
static void relay_record_switch(int relay_idx, bool turning_on) {
    if (relay_idx < 0 || relay_idx > 4) return;

    unsigned long now = millis();
    g_relay_stats[relay_idx].last_switch = now;
    g_relay_stats[relay_idx].cycle_count++;
    g_relay_stats[relay_idx].daily_cycles++;

    if (turning_on) {
        g_relay_stats[relay_idx].on_since = now;
    } else {
        // Accumulate ON time
        if (g_relay_stats[relay_idx].on_since > 0) {
            g_relay_stats[relay_idx].total_on_ms += (now - g_relay_stats[relay_idx].on_since);
            g_relay_stats[relay_idx].on_since = 0;
        }
    }

    // Mark EEPROM dirty for auto-save
    if (EEPROM_SAVE_ON_CHANGE) {
        eeprom_mark_state_dirty();
    }
}

// ============================================================
// Init
// ============================================================
void actuators_init() {
    // Light relays
    for (int i = 0; i < MAX_LIGHTS; i++) {
        pinMode(LIGHT_PINS[i], OUTPUT);
        digitalWrite(LIGHT_PINS[i], HIGH);  // Relay off (active LOW)

        ledcSetup(LIGHT_PWM_CHANNELS[i], PWM_LIGHT_FREQ, PWM_LIGHT_RESOLUTION);
    }

    // Fan relay + PWM
    pinMode(PIN_FAN_RELAY, OUTPUT);
    digitalWrite(PIN_FAN_RELAY, HIGH);
    ledcSetup(PWM_FAN_CHANNEL, PWM_FAN_FREQ, PWM_FAN_RESOLUTION);
    ledcAttachPin(PIN_FAN_PWM, PWM_FAN_CHANNEL);
    ledcWrite(PWM_FAN_CHANNEL, 0);

    // IR
    g_ir.begin();

    // Buzzer
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    // NeoPixel
    g_strip.begin();
    g_strip.setBrightness(NEOPIXEL_BRIGHTNESS);
    g_strip.clear();
    g_strip.show();

    // Clear relay stats
    memset(g_relay_stats, 0, sizeof(g_relay_stats));

    LOG_I("ACT", "Actuators v2.0 initialized: %d lights, fan, AC(IR), buzzer, %d NeoPixels",
          MAX_LIGHTS, NEOPIXEL_COUNT);
}

// ============================================================
// Loop
// ============================================================
void actuators_loop() {
    unsigned long now = millis();

    // ---- Smooth dimming transitions ----
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (g_light_brightness[i] != g_light_target_bri[i]) {
            if (g_light_brightness[i] < g_light_target_bri[i]) {
                g_light_brightness[i] = min((int)g_light_brightness[i] + 3, (int)g_light_target_bri[i]);
            } else {
                g_light_brightness[i] = max((int)g_light_brightness[i] - 3, (int)g_light_target_bri[i]);
            }
        }
    }

    // ---- NeoPixel Animations ----
    if (g_neo_animating && (now - g_neo_last_update >= 30)) {
        g_neo_last_update = now;

        switch (g_neo_anim) {
            case NEO_BREATHING: {
                float breath = (exp(sin(g_neo_anim_step * 0.02f)) - 0.36787944f) * 108.0f;
                uint8_t b = (uint8_t)constrain(breath, 0, 255);
                for (int i = 0; i < NEOPIXEL_COUNT; i++) {
                    g_strip.setPixelColor(i, g_strip.Color(
                        (g_neo_r * b) / 255,
                        (g_neo_g * b) / 255,
                        (g_neo_b * b) / 255));
                }
                g_strip.show();
                g_neo_anim_step++;
                break;
            }
            case NEO_RAINBOW: {
                for (int i = 0; i < NEOPIXEL_COUNT; i++) {
                    int hue = (g_neo_anim_step * 256 + i * 65536 / NEOPIXEL_COUNT) & 0xFFFF;
                    g_strip.setPixelColor(i, g_strip.gamma32(g_strip.ColorHSV(hue)));
                }
                g_strip.show();
                g_neo_anim_step++;
                break;
            }
            case NEO_ALERT: {
                bool on = (g_neo_anim_step % 10) < 5;
                for (int i = 0; i < NEOPIXEL_COUNT; i++) {
                    g_strip.setPixelColor(i, on ? g_strip.Color(255, 0, 0) : 0);
                }
                g_strip.show();
                g_neo_anim_step++;
                break;
            }
            default:
                break;
        }
    }

    // ---- Buzzer Patterns ----
    if (g_buzzer_pattern_active && (now - g_buzzer_pattern_time >= 200)) {
        g_buzzer_pattern_time = now;
        g_buzzer_pattern_step++;

        switch (g_buzzer_pattern) {
            case BUZ_GAS:
                if (g_buzzer_pattern_step % 2 == 0)
                    tone(PIN_BUZZER, 3000, 150);
                break;
            case BUZ_MOTION:
                if (g_buzzer_pattern_step % 6 < 2)
                    tone(PIN_BUZZER, 2000, 100);
                break;
            case BUZ_WATER:
                if (g_buzzer_pattern_step % 10 == 0)
                    tone(PIN_BUZZER, 1000, 500);
                break;
            default:
                break;
        }
    }

    // Auto-stop buzzer
    if (g_buzzer_end > 0 && now >= g_buzzer_end) {
        noTone(PIN_BUZZER);
        g_buzzer_end = 0;
    }
}

// ============================================================
// Light Control — with relay protection (v2.0)
// ============================================================
void light_set(int channel, bool on) {
    if (channel < 0 || channel >= MAX_LIGHTS) return;

    // Skip if already in desired state
    if (g_light_state[channel] == on) return;

    // Relay protection check
    if (!relay_can_switch(channel)) return;

    g_light_state[channel] = on;
    digitalWrite(LIGHT_PINS[channel], on ? LOW : HIGH);
    relay_record_switch(channel, on);

    LOG_D("ACT", "Light %d: %s (cycles: %u)", channel + 1, on ? "ON" : "OFF",
          g_relay_stats[channel].cycle_count);
}

void light_set_brightness(int channel, uint8_t brightness) {
    if (channel < 0 || channel >= MAX_LIGHTS) return;
    g_light_target_bri[channel] = brightness;
    if (brightness > 0 && !g_light_state[channel]) {
        light_set(channel, true);
    }
    if (brightness == 0) {
        light_set(channel, false);
    }
    LOG_D("ACT", "Light %d brightness -> %d", channel + 1, brightness);
}

bool light_get_state(int channel) {
    if (channel < 0 || channel >= MAX_LIGHTS) return false;
    return g_light_state[channel];
}

uint8_t light_get_brightness(int channel) {
    if (channel < 0 || channel >= MAX_LIGHTS) return 0;
    return g_light_brightness[channel];
}

void light_all_off() {
    for (int i = 0; i < MAX_LIGHTS; i++) light_set(i, false);
}

void light_all_on() {
    for (int i = 0; i < MAX_LIGHTS; i++) light_set(i, true);
}

// ============================================================
// Fan Control — with relay protection (v2.0)
// ============================================================
void fan_set(bool on) {
    if (g_fan_on == on) return;
    if (!relay_can_switch(4)) return;  // Relay 4 = fan

    g_fan_on = on;
    digitalWrite(PIN_FAN_RELAY, on ? LOW : HIGH);
    if (!on) ledcWrite(PWM_FAN_CHANNEL, 0);
    else ledcWrite(PWM_FAN_CHANNEL, map(g_fan_speed, 0, 100, 0, 255));

    relay_record_switch(4, on);
    LOG_D("ACT", "Fan: %s (cycles: %u)", on ? "ON" : "OFF", g_relay_stats[4].cycle_count);
}

void fan_set_speed(uint8_t speed_pct) {
    g_fan_speed = constrain(speed_pct, 0, 100);
    if (g_fan_on) {
        ledcWrite(PWM_FAN_CHANNEL, map(g_fan_speed, 0, 100, 0, 255));
    }
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
    LOG_D("ACT", "Fan speed: %d%%", g_fan_speed);
}

bool fan_get_state() { return g_fan_on; }
uint8_t fan_get_speed() { return g_fan_speed; }

// ============================================================
// AC / IR Control
// ============================================================
void ac_power_toggle() {
    g_ac_on = !g_ac_on;
    g_ir.sendNEC(AC_IR_POWER, 32);
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
    LOG_I("ACT", "AC power -> %s", g_ac_on ? "ON" : "OFF");
}

void ac_set_temperature(int temp) {
    int diff = temp - g_ac_temp;
    for (int i = 0; i < abs(diff); i++) {
        if (diff > 0) g_ir.sendNEC(AC_IR_TEMP_UP, 32);
        else          g_ir.sendNEC(AC_IR_TEMP_DN, 32);
        delay(200);
    }
    g_ac_temp = temp;
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
    LOG_I("ACT", "AC temp -> %d°C", g_ac_temp);
}

void ac_temp_up() {
    g_ac_temp++;
    g_ir.sendNEC(AC_IR_TEMP_UP, 32);
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
    LOG_D("ACT", "AC temp up -> %d°C", g_ac_temp);
}

void ac_temp_down() {
    g_ac_temp--;
    g_ir.sendNEC(AC_IR_TEMP_DN, 32);
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
    LOG_D("ACT", "AC temp down -> %d°C", g_ac_temp);
}

void ac_set_mode(const char* mode) {
    g_ac_mode = String(mode);
    g_ir.sendNEC(AC_IR_MODE, 32);
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
    LOG_I("ACT", "AC mode -> %s", mode);
}

void ac_set_fan_speed(const char* speed) {
    g_ac_fan_speed = String(speed);
    g_ir.sendNEC(AC_IR_FAN, 32);
    LOG_I("ACT", "AC fan -> %s", speed);
}

int ac_get_set_temp() { return g_ac_temp; }
bool ac_get_state() { return g_ac_on; }
String ac_get_mode() { return g_ac_mode; }

// ============================================================
// Buzzer
// ============================================================
void buzzer_beep(int freq, int duration_ms) {
    tone(PIN_BUZZER, freq, duration_ms);
    g_buzzer_end = millis() + duration_ms;
}

void buzzer_alert_gas() {
    g_buzzer_pattern = BUZ_GAS;
    g_buzzer_pattern_active = true;
    g_buzzer_pattern_step = 0;
    g_buzzer_pattern_time = millis();
    LOG_W("ACT", "Buzzer: GAS ALERT");
}

void buzzer_alert_motion() {
    g_buzzer_pattern = BUZ_MOTION;
    g_buzzer_pattern_active = true;
    g_buzzer_pattern_step = 0;
    g_buzzer_pattern_time = millis();
}

void buzzer_alert_water() {
    g_buzzer_pattern = BUZ_WATER;
    g_buzzer_pattern_active = true;
    g_buzzer_pattern_step = 0;
    g_buzzer_pattern_time = millis();
}

void buzzer_success() {
    tone(PIN_BUZZER, 1000, 100);
    delay(150);
    tone(PIN_BUZZER, 1500, 100);
    delay(150);
    tone(PIN_BUZZER, 2000, 150);
}

void buzzer_error() {
    tone(PIN_BUZZER, 400, 200);
    delay(250);
    tone(PIN_BUZZER, 300, 400);
}

void buzzer_stop() {
    noTone(PIN_BUZZER);
    g_buzzer_pattern_active = false;
    g_buzzer_pattern = BUZ_NONE;
}

// ============================================================
// NeoPixel
// ============================================================
void neopixel_set_color(uint8_t r, uint8_t g, uint8_t b) {
    g_neo_animating = false;
    g_neo_anim = NEO_NONE;
    for (int i = 0; i < NEOPIXEL_COUNT; i++) {
        g_strip.setPixelColor(i, g_strip.Color(r, g, b));
    }
    g_strip.show();
}

void neopixel_set_pixel(int pixel, uint8_t r, uint8_t g, uint8_t b) {
    if (pixel < 0 || pixel >= NEOPIXEL_COUNT) return;
    g_strip.setPixelColor(pixel, g_strip.Color(r, g, b));
    g_strip.show();
}

void neopixel_clear() {
    g_neo_animating = false;
    g_neo_anim = NEO_NONE;
    g_strip.clear();
    g_strip.show();
}

void neopixel_set_brightness(uint8_t brightness) {
    g_strip.setBrightness(brightness);
    g_strip.show();
}

void neopixel_status_ok()      { neopixel_set_color(0, 255, 0); }
void neopixel_status_warning() { neopixel_set_color(255, 165, 0); }
void neopixel_status_error()   { neopixel_set_color(255, 0, 0); }

void neopixel_animation_breathing(uint8_t r, uint8_t g, uint8_t b) {
    g_neo_r = r; g_neo_g = g; g_neo_b = b;
    g_neo_anim = NEO_BREATHING;
    g_neo_anim_step = 0;
    g_neo_animating = true;
}

void neopixel_animation_rainbow() {
    g_neo_anim = NEO_RAINBOW;
    g_neo_anim_step = 0;
    g_neo_animating = true;
}

void neopixel_animation_alert() {
    g_neo_anim = NEO_ALERT;
    g_neo_anim_step = 0;
    g_neo_animating = true;
}

// ============================================================
// Scene Management
// ============================================================
void scene_activate(Scene scene) {
    g_active_scene = scene;

    switch (scene) {
        case SCENE_MOVIE_NIGHT:
            LOG_I("ACT", "Scene: Movie Night");
            light_set_brightness(0, 30);
            light_set(1, false);
            light_set(2, false);
            light_set_brightness(3, 20);
            fan_set(true);
            fan_set_speed(30);
            ac_set_temperature(22);
            neopixel_animation_breathing(0, 0, 80);
            break;

        case SCENE_MORNING:
            LOG_I("ACT", "Scene: Morning");
            light_set_brightness(0, 255);
            light_set_brightness(1, 255);
            light_set_brightness(2, 200);
            light_set_brightness(3, 200);
            fan_set(true);
            fan_set_speed(40);
            ac_set_temperature(24);
            neopixel_set_color(255, 200, 100);
            break;

        case SCENE_SLEEP:
            LOG_I("ACT", "Scene: Sleep");
            light_all_off();
            fan_set(true);
            fan_set_speed(20);
            ac_set_temperature(25);
            neopixel_clear();
            break;

        case SCENE_AWAY:
            LOG_I("ACT", "Scene: Away (Security)");
            light_all_off();
            fan_set(false);
            if (g_ac_on) ac_power_toggle();
            neopixel_animation_breathing(255, 0, 0);
            break;

        case SCENE_PARTY:
            LOG_I("ACT", "Scene: Party");
            light_all_on();
            for (int i = 0; i < MAX_LIGHTS; i++) light_set_brightness(i, 255);
            fan_set(true);
            fan_set_speed(60);
            neopixel_animation_rainbow();
            break;

        case SCENE_READING:
            LOG_I("ACT", "Scene: Reading");
            light_set_brightness(0, 255);
            light_set(1, false);
            light_set(2, false);
            light_set_brightness(3, 180);
            fan_set(true);
            fan_set_speed(25);
            neopixel_set_color(255, 240, 220);
            break;

        case SCENE_NONE:
        default:
            break;
    }

    // Mark state dirty for EEPROM save
    if (EEPROM_SAVE_ON_CHANGE) eeprom_mark_state_dirty();
}

void scene_activate(const char* scene_name) {
    String s = String(scene_name);
    s.toLowerCase();

    if (s == "movie" || s == "movie_night")  scene_activate(SCENE_MOVIE_NIGHT);
    else if (s == "morning")                  scene_activate(SCENE_MORNING);
    else if (s == "sleep" || s == "night")    scene_activate(SCENE_SLEEP);
    else if (s == "away" || s == "security")  scene_activate(SCENE_AWAY);
    else if (s == "party")                    scene_activate(SCENE_PARTY);
    else if (s == "reading" || s == "read")   scene_activate(SCENE_READING);
    else if (s == "none" || s == "off")       { g_active_scene = SCENE_NONE; }
    else LOG_W("ACT", "Unknown scene: %s", scene_name);
}

String scene_get_active() {
    switch (g_active_scene) {
        case SCENE_MOVIE_NIGHT: return "movie_night";
        case SCENE_MORNING:     return "morning";
        case SCENE_SLEEP:       return "sleep";
        case SCENE_AWAY:        return "away";
        case SCENE_PARTY:       return "party";
        case SCENE_READING:     return "reading";
        case SCENE_CUSTOM_1:    return "custom_1";
        case SCENE_CUSTOM_2:    return "custom_2";
        default:                return "none";
    }
}

// ============================================================
// Relay Statistics (v2.0)
// ============================================================
RelayStats actuators_get_relay_stats(int channel) {
    if (channel < 0 || channel > 4) {
        RelayStats empty = {};
        return empty;
    }
    return g_relay_stats[channel];
}

String actuators_get_stats_json() {
    JsonDocument doc;
    const char* names[] = { "light1", "light2", "light3", "light4", "fan" };

    for (int i = 0; i < 5; i++) {
        JsonObject relay = doc[names[i]].to<JsonObject>();
        relay["cycles"]       = g_relay_stats[i].cycle_count;
        relay["daily_cycles"] = g_relay_stats[i].daily_cycles;

        // Calculate current ON duration
        unsigned long on_time = g_relay_stats[i].total_on_ms;
        if (g_relay_stats[i].on_since > 0) {
            on_time += (millis() - g_relay_stats[i].on_since);
        }
        relay["total_on_hours"] = serialized(float_to_string((float)on_time / 3600000.0f, 2));
    }

    String output;
    serializeJson(doc, output);
    return output;
}

void actuators_reset_daily_cycles() {
    for (int i = 0; i < 5; i++) {
        g_relay_stats[i].daily_cycles = 0;
    }
    LOG_I("ACT", "Daily relay cycle counters reset");
}

// ============================================================
// State JSON (v2.0) — full actuator state dump
// ============================================================
String actuators_get_state_json() {
    JsonDocument doc;

    JsonArray lights = doc["lights"].to<JsonArray>();
    for (int i = 0; i < MAX_LIGHTS; i++) {
        JsonObject l = lights.add<JsonObject>();
        l["channel"]    = i + 1;
        l["on"]         = g_light_state[i];
        l["brightness"] = g_light_brightness[i];
        l["cycles"]     = g_relay_stats[i].cycle_count;
    }

    JsonObject fan = doc["fan"].to<JsonObject>();
    fan["on"]    = g_fan_on;
    fan["speed"] = g_fan_speed;
    fan["cycles"]= g_relay_stats[4].cycle_count;

    JsonObject ac = doc["ac"].to<JsonObject>();
    ac["on"]         = g_ac_on;
    ac["temperature"]= g_ac_temp;
    ac["mode"]       = g_ac_mode;
    ac["fan_speed"]  = g_ac_fan_speed;

    doc["scene"] = scene_get_active();
    doc["device"] = DEVICE_ID;
    doc["timestamp"] = get_timestamp();

    String output;
    serializeJson(doc, output);
    return output;
}
