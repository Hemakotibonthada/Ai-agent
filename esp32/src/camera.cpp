// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Camera Module Implementation (AI-Thinker ESP32-CAM)
// ============================================================

#include "camera.h"
#include "config.h"
#include "utils.h"
#include <ArduinoJson.h>

// ---- Internal state ----
static CameraConfig  g_cam_config;
static CameraStatus  g_cam_status;
static bool          g_motion_baseline_set = false;
static uint8_t*      g_prev_frame = nullptr;
static size_t        g_prev_frame_len = 0;

// FPS calculation
static unsigned long g_fps_timestamps[16];
static int           g_fps_index = 0;
static int           g_fps_count = 0;

// ============================================================
// Initialisation
// ============================================================

bool camera_init(const CameraConfig& config) {
    g_cam_config = config;

    camera_config_t cam_cfg;
    cam_cfg.ledc_channel = LEDC_CHANNEL_0;
    cam_cfg.ledc_timer   = LEDC_TIMER_0;
    cam_cfg.pin_d0       = Y2_GPIO_NUM;
    cam_cfg.pin_d1       = Y3_GPIO_NUM;
    cam_cfg.pin_d2       = Y4_GPIO_NUM;
    cam_cfg.pin_d3       = Y5_GPIO_NUM;
    cam_cfg.pin_d4       = Y6_GPIO_NUM;
    cam_cfg.pin_d5       = Y7_GPIO_NUM;
    cam_cfg.pin_d6       = Y8_GPIO_NUM;
    cam_cfg.pin_d7       = Y9_GPIO_NUM;
    cam_cfg.pin_xclk     = XCLK_GPIO_NUM;
    cam_cfg.pin_pclk     = PCLK_GPIO_NUM;
    cam_cfg.pin_vsync    = VSYNC_GPIO_NUM;
    cam_cfg.pin_href     = HREF_GPIO_NUM;
    cam_cfg.pin_sscb_sda = SIOD_GPIO_NUM;
    cam_cfg.pin_sscb_scl = SIOC_GPIO_NUM;
    cam_cfg.pin_pwdn     = PWDN_GPIO_NUM;
    cam_cfg.pin_reset    = RESET_GPIO_NUM;
    cam_cfg.xclk_freq_hz = 20000000;
    cam_cfg.pixel_format = PIXFORMAT_JPEG;

    // Use PSRAM if available for higher resolution
    if (psramFound()) {
        cam_cfg.frame_size   = config.resolution;
        cam_cfg.jpeg_quality = config.quality;
        cam_cfg.fb_count     = 2;
        LOG_I("CAM", "PSRAM found – dual frame buffer enabled");
    } else {
        cam_cfg.frame_size   = FRAMESIZE_VGA;
        cam_cfg.jpeg_quality = 12;
        cam_cfg.fb_count     = 1;
        LOG_I("CAM", "No PSRAM – single buffer, VGA max");
    }

    esp_err_t err = esp_camera_init(&cam_cfg);
    if (err != ESP_OK) {
        LOG_E("CAM", "Camera init failed: 0x%x", err);
        g_cam_status.initialized = false;
        return false;
    }

    // Apply initial sensor settings
    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        s->set_brightness(s, config.brightness);
        s->set_contrast(s, config.contrast);
        s->set_saturation(s, config.saturation);
        s->set_hmirror(s, config.hmirror ? 1 : 0);
        s->set_vflip(s, config.vflip ? 1 : 0);
        if (config.nightMode) {
            s->set_gainceiling(s, GAINCEILING_8X);
            s->set_aec2(s, 1);
            s->set_ae_level(s, 2);
        }
    }

    // Configure flash LED pin
    pinMode(FLASH_GPIO_NUM, OUTPUT);
    digitalWrite(FLASH_GPIO_NUM, LOW);

    // Initialise status
    g_cam_status.initialized     = true;
    g_cam_status.streaming       = false;
    g_cam_status.recording       = false;
    g_cam_status.nightModeActive = config.nightMode;
    g_cam_status.framesCaptured  = 0;
    g_cam_status.lastFrameTime   = 0;
    g_cam_status.currentFPS      = 0.0f;
    g_cam_status.lastFrameSize   = 0;

    memset(g_fps_timestamps, 0, sizeof(g_fps_timestamps));
    g_fps_index = 0;
    g_fps_count = 0;

    LOG_I("CAM", "Camera initialised – resolution=%d quality=%d",
          (int)config.resolution, config.quality);
    return true;
}

void camera_deinit() {
    if (!g_cam_status.initialized) return;
    esp_camera_deinit();
    g_cam_status.initialized = false;
    g_cam_status.streaming   = false;
    if (g_prev_frame) {
        free(g_prev_frame);
        g_prev_frame     = nullptr;
        g_prev_frame_len = 0;
    }
    LOG_I("CAM", "Camera de-initialised");
}

// ============================================================
// Frame capture
// ============================================================

camera_fb_t* camera_capture_frame() {
    if (!g_cam_status.initialized) return nullptr;

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        LOG_E("CAM", "Frame capture failed");
        return nullptr;
    }

    g_cam_status.framesCaptured++;
    g_cam_status.lastFrameTime = millis();
    g_cam_status.lastFrameSize = fb->len;
    camera_update_fps();

    return fb;
}

void camera_return_frame(camera_fb_t* fb) {
    if (fb) esp_camera_fb_return(fb);
}

// ============================================================
// FPS tracking
// ============================================================

void camera_update_fps() {
    unsigned long now = millis();
    g_fps_timestamps[g_fps_index] = now;
    g_fps_index = (g_fps_index + 1) % 16;
    if (g_fps_count < 16) g_fps_count++;

    if (g_fps_count >= 2) {
        int oldest = (g_fps_index - g_fps_count + 16) % 16;
        unsigned long span = now - g_fps_timestamps[oldest];
        if (span > 0) {
            g_cam_status.currentFPS = (float)(g_fps_count - 1) * 1000.0f / (float)span;
        }
    }
}

// ============================================================
// Sensor control helpers
// ============================================================

bool camera_set_resolution(framesize_t res) {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    int rc = s->set_framesize(s, res);
    if (rc == 0) {
        g_cam_config.resolution = res;
        LOG_I("CAM", "Resolution changed to %d", (int)res);
    }
    return rc == 0;
}

bool camera_set_quality(int quality) {
    if (quality < 0 || quality > 63) return false;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    int rc = s->set_quality(s, quality);
    if (rc == 0) g_cam_config.quality = quality;
    return rc == 0;
}

bool camera_set_nightmode(bool enable) {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    if (enable) {
        s->set_gainceiling(s, GAINCEILING_8X);
        s->set_aec2(s, 1);
        s->set_ae_level(s, 2);
        s->set_agc_gain(s, 15);
    } else {
        s->set_gainceiling(s, GAINCEILING_2X);
        s->set_aec2(s, 0);
        s->set_ae_level(s, 0);
        s->set_agc_gain(s, 0);
    }
    g_cam_config.nightMode       = enable;
    g_cam_status.nightModeActive = enable;
    LOG_I("CAM", "Night mode %s", enable ? "ON" : "OFF");
    return true;
}

bool camera_set_hmirror(bool enable) {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_hmirror(s, enable ? 1 : 0);
    g_cam_config.hmirror = enable;
    return true;
}

bool camera_set_vflip(bool enable) {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_vflip(s, enable ? 1 : 0);
    g_cam_config.vflip = enable;
    return true;
}

// ============================================================
// Status
// ============================================================

CameraStatus camera_get_status() {
    return g_cam_status;
}

// ============================================================
// Settings serialisation
// ============================================================

String camera_get_settings_json() {
    StaticJsonDocument<512> doc;
    doc["resolution"]  = (int)g_cam_config.resolution;
    doc["quality"]     = g_cam_config.quality;
    doc["brightness"]  = g_cam_config.brightness;
    doc["contrast"]    = g_cam_config.contrast;
    doc["saturation"]  = g_cam_config.saturation;
    doc["hmirror"]     = g_cam_config.hmirror;
    doc["vflip"]       = g_cam_config.vflip;
    doc["nightMode"]   = g_cam_config.nightMode;
    doc["frameRate"]   = g_cam_config.frameRate;

    // Status fields
    doc["initialized"]     = g_cam_status.initialized;
    doc["streaming"]       = g_cam_status.streaming;
    doc["framesCaptured"]  = g_cam_status.framesCaptured;
    doc["currentFPS"]      = serialized(String(g_cam_status.currentFPS, 1));
    doc["lastFrameSize"]   = g_cam_status.lastFrameSize;

    String out;
    serializeJson(doc, out);
    return out;
}

bool camera_apply_settings(const String& json) {
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, json);
    if (err) {
        LOG_E("CAM", "Settings JSON parse error: %s", err.c_str());
        return false;
    }

    if (doc.containsKey("resolution")) {
        camera_set_resolution((framesize_t)doc["resolution"].as<int>());
    }
    if (doc.containsKey("quality")) {
        camera_set_quality(doc["quality"].as<int>());
    }
    if (doc.containsKey("brightness")) {
        sensor_t* s = esp_camera_sensor_get();
        if (s) { s->set_brightness(s, doc["brightness"].as<int>()); }
        g_cam_config.brightness = doc["brightness"].as<int>();
    }
    if (doc.containsKey("contrast")) {
        sensor_t* s = esp_camera_sensor_get();
        if (s) { s->set_contrast(s, doc["contrast"].as<int>()); }
        g_cam_config.contrast = doc["contrast"].as<int>();
    }
    if (doc.containsKey("saturation")) {
        sensor_t* s = esp_camera_sensor_get();
        if (s) { s->set_saturation(s, doc["saturation"].as<int>()); }
        g_cam_config.saturation = doc["saturation"].as<int>();
    }
    if (doc.containsKey("hmirror"))   camera_set_hmirror(doc["hmirror"].as<bool>());
    if (doc.containsKey("vflip"))     camera_set_vflip(doc["vflip"].as<bool>());
    if (doc.containsKey("nightMode")) camera_set_nightmode(doc["nightMode"].as<bool>());

    LOG_I("CAM", "Settings applied from JSON");
    return true;
}

// ============================================================
// Motion detection (simple frame differencing)
// ============================================================

bool camera_detect_motion(camera_fb_t* fb, int threshold) {
    if (!fb || fb->format != PIXFORMAT_JPEG) return false;

    // We compare raw JPEG sizes and byte-level diffs as a lightweight proxy.
    // For real pixel differencing, decode to RGB first – costly on ESP32.
    if (!g_motion_baseline_set || !g_prev_frame) {
        // Store first frame as baseline
        if (g_prev_frame) free(g_prev_frame);
        g_prev_frame = (uint8_t*)malloc(fb->len);
        if (g_prev_frame) {
            memcpy(g_prev_frame, fb->buf, fb->len);
            g_prev_frame_len = fb->len;
            g_motion_baseline_set = true;
        }
        return false;
    }

    // Compare frame sizes – large size delta often indicates scene change
    int sizeDiff = abs((int)fb->len - (int)g_prev_frame_len);
    float sizeRatio = (float)sizeDiff / (float)max(g_prev_frame_len, (size_t)1);

    // Byte-level sampling (compare every Nth byte for speed)
    size_t minLen = min(fb->len, g_prev_frame_len);
    int changedBytes = 0;
    int sampledBytes = 0;
    size_t step = max((size_t)1, minLen / 512);

    for (size_t i = 0; i < minLen; i += step) {
        int diff = abs((int)fb->buf[i] - (int)g_prev_frame[i]);
        if (diff > threshold) changedBytes++;
        sampledBytes++;
    }

    float changeRatio = (sampledBytes > 0)
                        ? (float)changedBytes / (float)sampledBytes
                        : 0.0f;

    // Update baseline
    if (g_prev_frame_len < fb->len) {
        uint8_t* tmp = (uint8_t*)realloc(g_prev_frame, fb->len);
        if (tmp) g_prev_frame = tmp;
    }
    if (g_prev_frame) {
        memcpy(g_prev_frame, fb->buf, fb->len);
        g_prev_frame_len = fb->len;
    }

    // Motion is detected when either metric exceeds threshold
    bool motion = (changeRatio > 0.12f) || (sizeRatio > 0.25f);
    if (motion) {
        LOG_I("CAM", "Motion detected: change=%.2f%% sizeΔ=%.2f%%",
              changeRatio * 100.0f, sizeRatio * 100.0f);
    }
    return motion;
}

void camera_reset_motion_baseline() {
    if (g_prev_frame) {
        free(g_prev_frame);
        g_prev_frame     = nullptr;
        g_prev_frame_len = 0;
    }
    g_motion_baseline_set = false;
    LOG_I("CAM", "Motion baseline reset");
}

// ============================================================
// Night-mode auto-switching based on frame brightness
// ============================================================

void camera_auto_nightmode(camera_fb_t* fb) {
    if (!fb || fb->len == 0) return;

    // Sample average brightness from JPEG payload (rough estimate)
    unsigned long sum = 0;
    size_t step = max((size_t)1, fb->len / 256);
    int samples = 0;
    for (size_t i = 0; i < fb->len; i += step) {
        sum += fb->buf[i];
        samples++;
    }
    uint8_t avgBrightness = (samples > 0) ? (uint8_t)(sum / samples) : 128;

    bool shouldBeNight = (avgBrightness < NIGHT_MODE_BRIGHTNESS_THRESHOLD);
    if (shouldBeNight != g_cam_status.nightModeActive) {
        camera_set_nightmode(shouldBeNight);
        LOG_I("CAM", "Auto night-mode toggled – avg brightness=%d", avgBrightness);
    }
}

// ============================================================
// Flash LED control
// ============================================================

void camera_set_flash(bool on) {
    digitalWrite(FLASH_GPIO_NUM, on ? HIGH : LOW);
}

// ============================================================
// MJPEG stream handler (called from web server)
// ============================================================

void camera_stream_handler() {
    // This is a convenience wrapper used by camera_stream.cpp.
    // The actual HTTP response writing happens in the stream server
    // because it needs the AsyncWebServerRequest* context.
    // See camera_stream.cpp → handle_stream() for the full
    // multipart/x-mixed-replace implementation.
    g_cam_status.streaming = true;
}
