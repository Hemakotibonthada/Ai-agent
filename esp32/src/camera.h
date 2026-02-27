#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Camera Module Header (AI-Thinker ESP32-CAM)
// ============================================================

#ifndef CAMERA_H
#define CAMERA_H

#include <Arduino.h>
#include "esp_camera.h"

// AI-Thinker ESP32-CAM pin definitions
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Flash LED pin (AI-Thinker board)
#define FLASH_GPIO_NUM     4

// Motion detection defaults
#define MOTION_THRESHOLD_DEFAULT  30
#define MOTION_BLOCK_SIZE         8
#define MOTION_MIN_CHANGED_BLOCKS 15

// Night-mode brightness threshold (0-255 average)
#define NIGHT_MODE_BRIGHTNESS_THRESHOLD  60

// Camera configuration
struct CameraConfig {
    framesize_t resolution;
    int quality;        // 0-63, lower = better
    int brightness;     // -2 to 2
    int contrast;       // -2 to 2
    int saturation;     // -2 to 2
    bool hmirror;
    bool vflip;
    bool nightMode;
    int frameRate;      // target FPS
};

// Camera status
struct CameraStatus {
    bool initialized;
    bool streaming;
    bool recording;
    bool nightModeActive;
    unsigned long framesCaptured;
    unsigned long lastFrameTime;
    float currentFPS;
    size_t lastFrameSize;
};

// Function declarations
bool camera_init(const CameraConfig& config);
void camera_deinit();
camera_fb_t* camera_capture_frame();
void camera_return_frame(camera_fb_t* fb);
bool camera_set_resolution(framesize_t res);
bool camera_set_quality(int quality);
bool camera_set_nightmode(bool enable);
bool camera_set_hmirror(bool enable);
bool camera_set_vflip(bool enable);
CameraStatus camera_get_status();
void camera_update_fps();
String camera_get_settings_json();
bool camera_apply_settings(const String& json);
void camera_stream_handler(); // called in web server for MJPEG stream

// Motion detection
bool camera_detect_motion(camera_fb_t* fb, int threshold = MOTION_THRESHOLD_DEFAULT);
void camera_reset_motion_baseline();

// Night mode auto
void camera_auto_nightmode(camera_fb_t* fb);
void camera_set_flash(bool on);

#endif // CAMERA_H
