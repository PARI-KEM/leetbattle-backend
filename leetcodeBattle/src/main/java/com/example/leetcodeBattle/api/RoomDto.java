package com.example.leetcodeBattle.api;

import com.example.leetcodeBattle.model.ChatMessage;
import com.example.leetcodeBattle.model.Player;
import com.example.leetcodeBattle.model.Question;
import com.example.leetcodeBattle.model.Room;

import java.util.List;
import java.util.Set;

public record RoomDto(
        String code,
        String hostId,
        int durationMinutes,
        int questionLimit,
        long startedAt,
        long createdAt,
        boolean started,
        List<Question> questions,
        Set<String> solvedSlugs,
        List<Player> players,
        List<ChatMessage> messages
) {
    public static RoomDto from(Room room) {
        return new RoomDto(
                room.code(),
                room.hostId(),
                room.durationMinutes(),
                room.questionLimit(),
                room.startedAt(),
                room.createdAt(),
                room.isStarted(),
                room.questions(),
                room.solvedSlugs(),
                room.players(),
                room.messages()
        );
    }
}
