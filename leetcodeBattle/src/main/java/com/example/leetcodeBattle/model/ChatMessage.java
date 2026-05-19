package com.example.leetcodeBattle.model;

public record ChatMessage(
        String id,
        String playerId,
        String playerName,
        String text,
        String kind,
        long timestamp
) {
    public static ChatMessage chat(String id, Player from, String text, long timestamp) {
        return new ChatMessage(id, from.id(), from.name(), text, "chat", timestamp);
    }

    public static ChatMessage system(String id, String text, long timestamp) {
        return new ChatMessage(id, null, "system", text, "system", timestamp);
    }

    public static ChatMessage completion(String id, Player from, String questionTitle, long timestamp) {
        String text = from.name() + " completed " + questionTitle + ".";
        return new ChatMessage(id, from.id(), from.name(), text, "completion", timestamp);
    }
}
