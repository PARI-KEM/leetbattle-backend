package com.example.leetcodeBattle.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class Room {

    public static final int MAX_QUESTIONS = 4;

    private final String code;
    private final String hostId;
    private final long createdAt;

    private int durationMinutes;
    private int questionLimit;
    private long startedAt;
    private final List<Question> questions = new ArrayList<>();
    private final Set<String> solvedSlugs = new LinkedHashSet<>();
    private final Map<String, Player> players = new LinkedHashMap<>();
    private final List<ChatMessage> messages = new ArrayList<>();

    public Room(String code, String hostId, int durationMinutes, int questionLimit, long createdAt) {
        this.code = code;
        this.hostId = hostId;
        this.durationMinutes = durationMinutes;
        this.questionLimit = Math.min(questionLimit, MAX_QUESTIONS);
        this.createdAt = createdAt;
    }

    public String code() { return code; }
    public String hostId() { return hostId; }
    public long createdAt() { return createdAt; }
    public int durationMinutes() { return durationMinutes; }
    public int questionLimit() { return questionLimit; }
    public long startedAt() { return startedAt; }
    public List<Question> questions() { return List.copyOf(questions); }
    public Set<String> solvedSlugs() { return Set.copyOf(solvedSlugs); }
    public List<Player> players() { return List.copyOf(players.values()); }
    public List<ChatMessage> messages() { return List.copyOf(messages); }

    public boolean isStarted() { return startedAt > 0; }
    public Player player(String playerId) { return players.get(playerId); }
    public boolean hasPlayer(String playerId) { return players.containsKey(playerId); }

    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }
    public void setQuestionLimit(int questionLimit) {
        this.questionLimit = Math.min(questionLimit, MAX_QUESTIONS);
    }

    public void addPlayer(Player player) {
        players.put(player.id(), player);
    }

    public void setQuestions(List<Question> next) {
        questions.clear();
        int limit = Math.min(next.size(), questionLimit);
        for (int i = 0; i < limit; i++) {
            questions.add(next.get(i));
        }
    }

    public void start(long now) {
        this.startedAt = now;
    }

    public boolean markSolved(String slug) {
        for (Question q : questions) {
            if (q.titleSlug().equals(slug)) {
                return solvedSlugs.add(slug);
            }
        }
        return false;
    }

    public Question questionBySlug(String slug) {
        for (Question q : questions) {
            if (q.titleSlug().equals(slug)) return q;
        }
        return null;
    }

    public void addMessage(ChatMessage message) {
        messages.add(message);
    }
}
