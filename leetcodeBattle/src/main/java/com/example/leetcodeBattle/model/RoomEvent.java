package com.example.leetcodeBattle.model;

public record RoomEvent(String type, Object payload) {
    public static RoomEvent of(String type, Object payload) {
        return new RoomEvent(type, payload);
    }
}
