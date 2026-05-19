package com.example.leetcodeBattle.api;

import com.example.leetcodeBattle.model.ChatMessage;
import com.example.leetcodeBattle.model.Player;

public final class RoomResponses {

    private RoomResponses() {}

    public record CreateRoom(String playerId, RoomDto room) {}

    public record JoinRoom(Player player, RoomDto room) {}

    public record Chat(ChatMessage message) {}
}
