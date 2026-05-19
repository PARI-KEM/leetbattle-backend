package com.example.leetcodeBattle.ws;

import com.example.leetcodeBattle.model.RoomEvent;
import com.example.leetcodeBattle.service.RoomEventListener;
import com.example.leetcodeBattle.service.RoomService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RoomWebSocketHandler extends TextWebSocketHandler implements RoomEventListener {

    static final String ROOM_CODE_ATTR = "roomCode";

    private final RoomService roomService;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ConcurrentHashMap<String, Set<WebSocketSession>> sessionsByRoom = new ConcurrentHashMap<>();

    public RoomWebSocketHandler(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostConstruct
    void register() {
        roomService.addListener(this);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String code = extractRoomCode(session);
        if (code == null || roomService.get(code) == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        session.getAttributes().put(ROOM_CODE_ATTR, code);
        sessionsByRoom
                .computeIfAbsent(code, key -> ConcurrentHashMap.newKeySet())
                .add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String code = (String) session.getAttributes().get(ROOM_CODE_ATTR);
        if (code == null) return;
        Set<WebSocketSession> sessions = sessionsByRoom.get(code);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                sessionsByRoom.remove(code, sessions);
            }
        }
    }

    @Override
    public void onEvent(String roomCode, RoomEvent event) {
        Set<WebSocketSession> sessions = sessionsByRoom.get(roomCode);
        if (sessions == null || sessions.isEmpty()) return;
        String payload;
        try {
            payload = mapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            return;
        }
        TextMessage message = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) continue;
            try {
                synchronized (session) {
                    session.sendMessage(message);
                }
            } catch (IOException ignored) {
                // best-effort delivery; closed sockets get cleaned up on close
            }
        }
    }

    private String extractRoomCode(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return null;
        String path = uri.getPath();
        int idx = path.lastIndexOf('/');
        if (idx < 0 || idx == path.length() - 1) return null;
        return path.substring(idx + 1).toUpperCase();
    }
}
