package com.example.leetcodeBattle.service;

import com.example.leetcodeBattle.model.ChatMessage;
import com.example.leetcodeBattle.model.Player;
import com.example.leetcodeBattle.model.Question;
import com.example.leetcodeBattle.model.Room;
import com.example.leetcodeBattle.model.RoomEvent;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RoomService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_PLAYERS = 8;

    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<RoomEventListener> listeners = new CopyOnWriteArrayList<>();

    public void addListener(RoomEventListener listener) {
        listeners.add(listener);
    }

    public Room createRoom(String hostName, int durationMinutes, int questionLimit) {
        String hostId = newPlayerId();
        long now = System.currentTimeMillis();
        Player host = new Player(hostId, sanitizeName(hostName, "Host"), now);
        String code = generateUniqueCode();
        Room room = new Room(code, hostId, clampDuration(durationMinutes), questionLimit, now);
        room.addPlayer(host);
        rooms.put(code, room);
        return room;
    }

    public Room get(String code) {
        return rooms.get(normalize(code));
    }

    public Room requireRoom(String code) {
        Room room = get(code);
        if (room == null) {
            throw new IllegalArgumentException("Room not found: " + code);
        }
        return room;
    }

    public Player join(String code, String playerName) {
        Room room = requireRoom(code);
        synchronized (room) {
            if (room.players().size() >= MAX_PLAYERS) {
                throw new IllegalStateException("Room is full");
            }
            Player player = new Player(newPlayerId(), sanitizeName(playerName, "Player"), System.currentTimeMillis());
            room.addPlayer(player);
            broadcast(room.code(), RoomEvent.of("player-joined", player));
            return player;
        }
    }

    public Room setQuestions(String code, String requesterId, List<Question> questions) {
        Room room = requireRoom(code);
        synchronized (room) {
            requireHost(room, requesterId);
            if (room.isStarted()) {
                throw new IllegalStateException("Battle already started");
            }
            room.setQuestions(questions);
            broadcast(room.code(), RoomEvent.of("questions-updated", room.questions()));
            return room;
        }
    }

    public Room startBattle(String code, String requesterId) {
        Room room = requireRoom(code);
        synchronized (room) {
            requireHost(room, requesterId);
            if (room.isStarted()) {
                throw new IllegalStateException("Battle already started");
            }
            if (room.questions().isEmpty()) {
                throw new IllegalStateException("Pick at least one question before starting");
            }
            room.start(System.currentTimeMillis());
            broadcast(room.code(), RoomEvent.of("battle-started", room.startedAt()));
            return room;
        }
    }

    public ChatMessage postChat(String code, String playerId, String text) {
        Room room = requireRoom(code);
        synchronized (room) {
            Player player = requirePlayer(room, playerId);
            String trimmed = text == null ? "" : text.strip();
            if (trimmed.isEmpty()) {
                throw new IllegalArgumentException("Message cannot be empty");
            }
            if (trimmed.length() > 500) {
                trimmed = trimmed.substring(0, 500);
            }
            ChatMessage message = ChatMessage.chat(newMessageId(), player, trimmed, System.currentTimeMillis());
            room.addMessage(message);
            broadcast(room.code(), RoomEvent.of("chat", message));
            return message;
        }
    }

    public ChatMessage markComplete(String code, String playerId, String slug) {
        Room room = requireRoom(code);
        synchronized (room) {
            Player player = requirePlayer(room, playerId);
            Question question = room.questionBySlug(slug);
            if (question == null) {
                throw new IllegalArgumentException("Question not in this battle");
            }
            boolean firstTime = room.markSolved(slug);
            ChatMessage message = ChatMessage.completion(newMessageId(), player, question.title(), System.currentTimeMillis());
            room.addMessage(message);
            broadcast(room.code(), RoomEvent.of("chat", message));
            if (firstTime) {
                broadcast(room.code(), RoomEvent.of("question-solved", new SolvedPayload(slug, player.id(), player.name())));
            }
            return message;
        }
    }

    private void broadcast(String roomCode, RoomEvent event) {
        for (RoomEventListener listener : listeners) {
            try {
                listener.onEvent(roomCode, event);
            } catch (RuntimeException ignored) {
                // listener failures must not break room state updates
            }
        }
    }

    private void requireHost(Room room, String requesterId) {
        if (!room.hostId().equals(requesterId)) {
            throw new IllegalStateException("Only the host can do that");
        }
    }

    private Player requirePlayer(Room room, String playerId) {
        Player player = room.player(playerId);
        if (player == null) {
            throw new IllegalArgumentException("Player not in this room");
        }
        return player;
    }

    private String generateUniqueCode() {
        for (int attempts = 0; attempts < 32; attempts++) {
            String candidate = randomCode();
            if (!rooms.containsKey(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not allocate a unique room code");
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    private String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private String sanitizeName(String name, String fallback) {
        if (name == null) return fallback;
        String trimmed = name.strip();
        if (trimmed.isEmpty()) return fallback;
        if (trimmed.length() > 40) trimmed = trimmed.substring(0, 40);
        return trimmed;
    }

    private int clampDuration(int minutes) {
        if (minutes < 5) return 5;
        if (minutes > 240) return 240;
        return minutes;
    }

    private String newPlayerId() {
        return "p_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String newMessageId() {
        return "m_" + UUID.randomUUID().toString().substring(0, 12);
    }

    public record SolvedPayload(String slug, String playerId, String playerName) {}
}
