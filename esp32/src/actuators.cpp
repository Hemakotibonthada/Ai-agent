// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Actuators Implementation
// ============================================================

#include "actuators.h"
#include "config.h"
#include "utils.h"
#include <Adafruit_NeoPixel.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>

// ---- NeoPixel ----
static Adafruit_NeoPixel g_strip(NEOPIXEL_COUNT, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// ---- IR Sender ----
static IRsend g_ir(PIN_IR_LED);

// ---- Light State ----
static const int LIGHT_PINS[] = { PIN_RELAY_LIGHT1, PIN_RELAY_LIGHT2, PIN_RELAY_LIGHT3, PIN_RELAY_LIGHT4 };
static bool     g_light_state[4] = { false, false, false, false };
static uint8_t  g_light_brightness[4] = { 255, 255, 255, 255 };
static uint8_t  g_light_target_bri[4] = { 255, 255, 255, 255 };

// ---- Fan State ----
static bool    g_fan_on = false;
static uint8_t g_fan_speed = 0; // 0-100

// ---- AC State ----
static bool   g_ac_on = false;
static int    g_ac_temp = 24;
static String g_ac_mode = "cool";
static String g_ac_fan_speed = "auto";

// ---- Scene ----
static Scene g_active_scene = SCENE_NONE;

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

// ---- PWM Light channels (MOSFET dimming) ----
static const int LIGHT_PWM_CHANNELS[] = { 1, 2, 3, 4 };

// ============================================================
// AC IR Protocol - Generic NEC-like codes
// ============================================================
// These are common AC IR codes (NEC protocol). Adjust for your specific AC brand.
#define AC_IR_POWER   0x10AF8877UL
#define AC_IR_TEMP_UP 0x10AF708FUL
#define AC_IR_TEMP_DN 0x10AFB04FUL
#define AC_IR_MODE    0x10AF807FUL
#define AC_IR_FAN     0x10AF40BFUL
#define AC_IR_SWING   0x10AF906FUL

// ============================================================
// Init
// ============================================================
void actuators_init() {
    // Light relays
    for (int i = 0; i < 4; i++) {
        pinMode(LIGHT_PINS[i], OUTPUT);
        digitalWrite(LIGHT_PINS[i], HIGH); // Relay off (active LOW)

        // Setup PWM for dimming
        ledcSetup(LIGHT_PWM_CHANNELS[i], PWM_LIGHT_FREQ, PWM_LIGHT_RESOLUTION);
        // Note: PWM dimming via MOSFET would use separate pins.
        // Here we use relay for on/off and brightness stored for scenes.
    }

    // Fan relay + PWM
    pinMode(PIN_FAN_RELAY, OUTPUT);
    digitalWrite(PIN_FAN_RELAY, HIGH); // Off
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

    LOG_I("ACT", "Actuators initialized: 4 lights, fan, AC(IR), buzzer, %d NeoPixels", NEOPIXEL_COUNT);
}

// ============================================================
// Loop - handle animations, dimming transitions, buzzer patterns
// ============================================================
void actuators_loop() {
    unsigned long now = millis();

    // ---- Smooth dimming transitions ----
    for (int i = 0; i < 4; i++) {
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
                // Sine-wave breathing effect
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
                // Flash red
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
                // Rapid beeping
                if (g_buzzer_pattern_step % 2 == 0)
                    tone(PIN_BUZZER, 3000, 150);
                break;
            case BUZ_MOTION:
                // Two short beeps then pause
                if (g_buzzer_pattern_step % 6 < 2)
                    tone(PIN_BUZZER, 2000, 100);
                break;
            case BUZ_WATER:
                // Slow low-frequency beeps
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
// Light Control
// ============================================================
void light_set(int channel, bool on) {
    if (channel < 0 || channel > 3) return;
    g_light_state[channel] = on;
    digitalWrite(LIGHT_PINS[channel], on ? LOW : HIGH); // Active LOW relay
    LOG_D("ACT", "Light %d: %s", channel + 1, on ? "ON" : "OFF");
}

void light_set_brightness(int channel, uint8_t brightness) {
    if (channel < 0 || channel > 3) return;
    g_light_target_bri[channel] = brightness;
    // If brightness > 0, turn on
    if (brightness > 0 && !g_light_state[channel]) {
        light_set(channel, true);
    }
    if (brightness == 0) {
        light_set(channel, false);
    }
    LOG_D("ACT", "Light %d brightness -> %d", channel + 1, brightness);
}

bool light_get_state(int channel) {
    if (channel < 0 || channel > 3) return false;
    return g_light_state[channel];
}

uint8_t light_get_brightness(int channel) {
    if (channel < 0 || channel > 3) return 0;
    return g_light_brightness[channel];
}

void light_all_off() {
    for (int i = 0; i < 4; i++) light_set(i, false);
}

void light_all_on() {
    for (int i = 0; i < 4; i++) light_set(i, true);
}

// ============================================================
// Fan Control
// ============================================================
void fan_set(bool on) {
    g_fan_on = on;
    digitalWrite(PIN_FAN_RELAY, on ? LOW : HIGH);
    if (!on) ledcWrite(PWM_FAN_CHANNEL, 0);
    else ledcWrite(PWM_FAN_CHANNEL, map(g_fan_speed, 0, 100, 0, 255));
    LOG_D("ACT", "Fan: %s", on ? "ON" : "OFF");
}

void fan_set_speed(uint8_t speed_pct) {
    g_fan_speed = constrain(speed_pct, 0, 100);
    if (g_fan_on) {
        ledcWrite(PWM_FAN_CHANNEL, map(g_fan_speed, 0, 100, 0, 255));
    }
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
    LOG_I("ACT", "AC power -> %s", g_ac_on ? "ON" : "OFF");
}

void ac_set_temperature(int temp) {
    int diff = temp - g_ac_temp;
    for (int i = 0; i < abs(diff); i++) {
        if (diff > 0) {
            g_ir.sendNEC(AC_IR_TEMP_UP, 32);
        } else {
            g_ir.sendNEC(AC_IR_TEMP_DN, 32);
        }
        delay(200);
    }
    g_ac_temp = temp;
    LOG_I("ACT", "AC temp -> %d°C", g_ac_temp);
}

void ac_temp_up() {
    g_ac_temp++;
    g_ir.sendNEC(AC_IR_TEMP_UP, 32);
    LOG_D("ACT", "AC temp up -> %d°C", g_ac_temp);
}

void ac_temp_down() {
    g_ac_temp--;
    g_ir.sendNEC(AC_IR_TEMP_DN, 32);
    LOG_D("ACT", "AC temp down -> %d°C", g_ac_temp);
}

void ac_set_mode(const char* mode) {
    g_ac_mode = String(mode);
    g_ir.sendNEC(AC_IR_MODE, 32);
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

void neopixel_status_ok() {
    neopixel_set_color(0, 255, 0); // Green
}

void neopixel_status_warning() {
    neopixel_set_color(255, 165, 0); // Orange
}

void neopixel_status_error() {
    neopixel_set_color(255, 0, 0); // Red
}

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
            light_set_brightness(0, 30);   // Dim light 1
            light_set(1, false);           // Light 2 off
            light_set(2, false);           // Light 3 off
            light_set_brightness(3, 20);   // Very dim light 4
            fan_set(true);
            fan_set_speed(30);
            ac_set_temperature(22);
            neopixel_animation_breathing(0, 0, 80); // Dim blue breathing
            break;

        case SCENE_MORNING:
            LOG_I("ACT", "Scene: Morning");
            light_set_brightness(0, 255);  // Full brightness
            light_set_brightness(1, 255);
            light_set_brightness(2, 200);
            light_set_brightness(3, 200);
            fan_set(true);
            fan_set_speed(40);
            ac_set_temperature(24);
            neopixel_set_color(255, 200, 100); // Warm white
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
            // AC off
            if (g_ac_on) ac_power_toggle();
            neopixel_animation_breathing(255, 0, 0); // Red breathing = armed
            break;

        case SCENE_PARTY:
            LOG_I("ACT", "Scene: Party");
            light_all_on();
            for (int i = 0; i < 4; i++) light_set_brightness(i, 255);
            fan_set(true);
            fan_set_speed(60);
            neopixel_animation_rainbow();
            break;

        case SCENE_READING:
            LOG_I("ACT", "Scene: Reading");
            light_set_brightness(0, 255);  // Main light full
            light_set(1, false);
            light_set(2, false);
            light_set_brightness(3, 180);
            fan_set(true);
            fan_set_speed(25);
            neopixel_set_color(255, 240, 220); // Warm
            break;

        case SCENE_NONE:
        default:
            break;
    }
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
        default:                return "none";
    }
}
