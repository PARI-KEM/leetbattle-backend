package com.example.leetcodeBattle.api;

import com.example.leetcodeBattle.model.Question;

import java.util.List;

public final class RoomRequests {

    private RoomRequests() {}

    public record CreateRoom(String hostName, Integer durationMinutes, Integer questionLimit) {}

    public record JoinRoom(String playerName) {}

    public record SetQuestions(String playerId, List<Question> questions) {}

    public record StartBattle(String playerId) {}

    public record PostChat(String playerId, String text) {}

    public record CompleteQuestion(String playerId, String slug) {}
}
