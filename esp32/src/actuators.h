#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Actuators Header
// ============================================================

#ifndef ACTUATORS_H
#define ACTUATORS_H

#include <Arduino.h>

// Scene definitions
enum Scene {
    SCENE_NONE,
    SCENE_MOVIE_NIGHT,
    SCENE_MORNING,
    SCENE_SLEEP,
    SCENE_AWAY,
    SCENE_PARTY,
    SCENE_READING
};

void    actuators_init();
void    actuators_loop();

// Light control (channels 0-3)
void    light_set(int channel, bool on);
void    light_set_brightness(int channel, uint8_t brightness); // 0-255
bool    light_get_state(int channel);
uint8_t light_get_brightness(int channel);
void    light_all_off();
void    light_all_on();

// Fan control
void    fan_set(bool on);
void    fan_set_speed(uint8_t speed_pct); // 0-100
bool    fan_get_state();
uint8_t fan_get_speed();

// AC/IR control
void    ac_power_toggle();
void    ac_set_temperature(int temp);
void    ac_temp_up();
void    ac_temp_down();
void    ac_set_mode(const char* mode); // cool, heat, auto, fan, dry
void    ac_set_fan_speed(const char* speed); // auto, low, mid, high
int     ac_get_set_temp();
bool    ac_get_state();
String  ac_get_mode();

// Buzzer
void    buzzer_beep(int freq, int duration_ms);
void    buzzer_alert_gas();
void    buzzer_alert_motion();
void    buzzer_alert_water();
void    buzzer_success();
void    buzzer_error();
void    buzzer_stop();

// NeoPixel
void    neopixel_set_color(uint8_t r, uint8_t g, uint8_t b);
void    neopixel_set_pixel(int pixel, uint8_t r, uint8_t g, uint8_t b);
void    neopixel_clear();
void    neopixel_set_brightness(uint8_t brightness);
void    neopixel_status_ok();
void    neopixel_status_warning();
void    neopixel_status_error();
void    neopixel_animation_breathing(uint8_t r, uint8_t g, uint8_t b);
void    neopixel_animation_rainbow();
void    neopixel_animation_alert();

// Scenes
void    scene_activate(Scene scene);
void    scene_activate(const char* scene_name);
String  scene_get_active();

#endif // ACTUATORS_H
