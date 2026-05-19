package com.example.leetcodeBattle.service;

import com.example.leetcodeBattle.model.RoomEvent;

public interface RoomEventListener {
    void onEvent(String roomCode, RoomEvent event);
}
