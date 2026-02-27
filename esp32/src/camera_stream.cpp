// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Camera HTTP Streaming Server
// ============================================================

#include "camera.h"
#include "config.h"
#include "utils.h"
#include "web_server.h"
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// ---- MJPEG boundary ----
#define MJPEG_BOUNDARY       "nexus_frame_boundary"
#define MJPEG_CONTENT_TYPE   "multipart/x-mixed-replace;boundary=" MJPEG_BOUNDARY
#define PART_HEADER_FMT      "--" MJPEG_BOUNDARY "\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n"
#define PART_HEADER_MAX_LEN  128

// Camera stream server port (separate from main web server)
#ifndef CAMERA_STREAM_PORT
#define CAMERA_STREAM_PORT   81
#endif

// Maximum concurrent stream clients
#define MAX_STREAM_CLIENTS   3

static AsyncWebServer g_cam_server(CAMERA_STREAM_PORT);
static int g_active_streams = 0;

// ============================================================
// /stream - MJPEG live feed
// ============================================================

static void handle_stream(AsyncWebServerRequest* request) {
    if (g_active_streams >= MAX_STREAM_CLIENTS) {
        request->send(503, "text/plain", "Max stream clients reached");
        return;
    }

    CameraStatus st = camera_get_status();
    if (!st.initialized) {
        request->send(503, "text/plain", "Camera not initialised");
        return;
    }

    g_active_streams++;
    camera_stream_handler();  // mark streaming active

    // Use chunked response for continuous MJPEG streaming
    AsyncWebServerResponse* response = request->beginChunkedResponse(
        MJPEG_CONTENT_TYPE,
        [](uint8_t* buffer, size_t maxLen, size_t index) -> size_t {
            // Capture a frame
            camera_fb_t* fb = camera_capture_frame();
            if (!fb) return 0;

            // Auto night-mode check every 30 frames
            CameraStatus cst = camera_get_status();
            if (cst.framesCaptured % 30 == 0) {
                camera_auto_nightmode(fb);
            }

            // Build MJPEG part header
            char partHeader[PART_HEADER_MAX_LEN];
            int headerLen = snprintf(partHeader, sizeof(partHeader),
                                     PART_HEADER_FMT, (unsigned int)fb->len);

            size_t totalLen = (size_t)headerLen + fb->len + 2; // +2 for trailing \r\n
            if (totalLen > maxLen) {
                // Frame too large for buffer – skip this frame
                camera_return_frame(fb);
                return 0;
            }

            // Copy header
            memcpy(buffer, partHeader, headerLen);
            // Copy JPEG data
            memcpy(buffer + headerLen, fb->buf, fb->len);
            // Trailing CRLF
            buffer[headerLen + fb->len]     = '\r';
            buffer[headerLen + fb->len + 1] = '\n';

            camera_return_frame(fb);
            return totalLen;
        }
    );

    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response->addHeader("Connection", "keep-alive");
    request->send(response);

    LOG_I("CAM-STREAM", "Stream client connected from %s (active=%d)",
          request->client()->remoteIP().toString().c_str(), g_active_streams);
}

// ============================================================
// /capture - Single JPEG frame
// ============================================================

static void handle_capture(AsyncWebServerRequest* request) {
    CameraStatus st = camera_get_status();
    if (!st.initialized) {
        request->send(503, "text/plain", "Camera not initialised");
        return;
    }

    camera_fb_t* fb = camera_capture_frame();
    if (!fb) {
        request->send(500, "text/plain", "Frame capture failed");
        return;
    }

    // Check for motion while we have the frame
    bool motion = camera_detect_motion(fb);

    AsyncWebServerResponse* response = request->beginResponse_P(
        200, "image/jpeg", fb->buf, fb->len
    );
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Cache-Control", "no-cache");
    response->addHeader("X-Frame-Size", String(fb->len));
    response->addHeader("X-Motion-Detected", motion ? "true" : "false");
    request->send(response);

    camera_return_frame(fb);
}

// ============================================================
// /status - Camera status JSON
// ============================================================

static void handle_status(AsyncWebServerRequest* request) {
    CameraStatus st = camera_get_status();

    StaticJsonDocument<384> doc;
    doc["initialized"]     = st.initialized;
    doc["streaming"]       = st.streaming;
    doc["recording"]       = st.recording;
    doc["nightModeActive"] = st.nightModeActive;
    doc["framesCaptured"]  = st.framesCaptured;
    doc["lastFrameTime"]   = st.lastFrameTime;
    doc["currentFPS"]      = serialized(String(st.currentFPS, 1));
    doc["lastFrameSize"]   = st.lastFrameSize;
    doc["activeStreams"]    = g_active_streams;
    doc["uptime"]          = millis() / 1000;

    String json;
    serializeJson(doc, json);

    AsyncWebServerResponse* response = request->beginResponse(200, "application/json", json);
    response->addHeader("Access-Control-Allow-Origin", "*");
    request->send(response);
}

// ============================================================
// /settings - GET current / POST update camera settings
// ============================================================

static void handle_settings_get(AsyncWebServerRequest* request) {
    String json = camera_get_settings_json();
    AsyncWebServerResponse* response = request->beginResponse(200, "application/json", json);
    response->addHeader("Access-Control-Allow-Origin", "*");
    request->send(response);
}

static void handle_settings_post(AsyncWebServerRequest* request,
                                  uint8_t* data, size_t len,
                                  size_t index, size_t total) {
    // Accumulate body – for simplicity assume single chunk
    if (index == 0 && len == total) {
        String body;
        body.reserve(len + 1);
        for (size_t i = 0; i < len; i++) body += (char)data[i];

        bool ok = camera_apply_settings(body);
        if (ok) {
            request->send(200, "application/json", "{\"status\":\"ok\"}");
        } else {
            request->send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid settings\"}");
        }
    }
}

// ============================================================
// /flash - Toggle flash LED
// ============================================================

static void handle_flash(AsyncWebServerRequest* request) {
    bool on = true;
    if (request->hasParam("state")) {
        String state = request->getParam("state")->value();
        on = (state == "1" || state == "on" || state == "true");
    }
    camera_set_flash(on);

    String resp = "{\"flash\":";
    resp += on ? "true" : "false";
    resp += "}";
    request->send(200, "application/json", resp);
}

// ============================================================
// /motion/reset - Reset motion detection baseline
// ============================================================

static void handle_motion_reset(AsyncWebServerRequest* request) {
    camera_reset_motion_baseline();
    request->send(200, "application/json", "{\"status\":\"ok\",\"message\":\"Motion baseline reset\"}");
}

// ============================================================
// Initialise camera stream server & register routes
// ============================================================

void camera_stream_server_init() {
    // MJPEG live stream
    g_cam_server.on("/stream", HTTP_GET, handle_stream);

    // Single JPEG capture
    g_cam_server.on("/capture", HTTP_GET, handle_capture);

    // Camera status
    g_cam_server.on("/status", HTTP_GET, handle_status);

    // Camera settings – GET & POST
    g_cam_server.on("/settings", HTTP_GET, handle_settings_get);
    g_cam_server.on("/settings", HTTP_POST, [](AsyncWebServerRequest* request) {},
                    nullptr, handle_settings_post);

    // Flash control
    g_cam_server.on("/flash", HTTP_GET, handle_flash);

    // Motion baseline reset
    g_cam_server.on("/motion/reset", HTTP_GET, handle_motion_reset);

    // CORS preflight
    g_cam_server.on("/settings", HTTP_OPTIONS, [](AsyncWebServerRequest* request) {
        AsyncWebServerResponse* response = request->beginResponse(204);
        response->addHeader("Access-Control-Allow-Origin", "*");
        response->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response->addHeader("Access-Control-Allow-Headers", "Content-Type");
        request->send(response);
    });

    g_cam_server.begin();
    LOG_I("CAM-STREAM", "Camera stream server started on port %d", CAMERA_STREAM_PORT);
    LOG_I("CAM-STREAM", "Endpoints: /stream /capture /status /settings /flash /motion/reset");
}
