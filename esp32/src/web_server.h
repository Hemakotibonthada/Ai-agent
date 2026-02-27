#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Web Server Header
// ============================================================

#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

void       webserver_init();
void       webserver_loop();
void       webserver_stop();
void       webserver_start();

// WebSocket
void       webserver_ws_broadcast(const String& message);
void       webserver_ws_send_sensor_update();

// Config
void       webserver_set_auth(const String& user, const String& pass);

#endif // WEB_SERVER_H
