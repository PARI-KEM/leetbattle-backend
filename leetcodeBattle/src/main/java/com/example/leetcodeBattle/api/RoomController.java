package com.example.leetcodeBattle.api;

import com.example.leetcodeBattle.model.ChatMessage;
import com.example.leetcodeBattle.model.Player;
import com.example.leetcodeBattle.model.Room;
import com.example.leetcodeBattle.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping
    public RoomResponses.CreateRoom create(@RequestBody RoomRequests.CreateRoom request) {
        int duration = request.durationMinutes() == null ? 45 : request.durationMinutes();
        int limit = request.questionLimit() == null ? 4 : request.questionLimit();
        Room room = roomService.createRoom(request.hostName(), duration, limit);
        return new RoomResponses.CreateRoom(room.hostId(), RoomDto.from(room));
    }

    @GetMapping("/{code}")
    public RoomDto get(@PathVariable String code) {
        return RoomDto.from(roomService.requireRoom(code));
    }

    @PostMapping("/{code}/join")
    public RoomResponses.JoinRoom join(@PathVariable String code, @RequestBody RoomRequests.JoinRoom request) {
        Player player = roomService.join(code, request.playerName());
        return new RoomResponses.JoinRoom(player, RoomDto.from(roomService.requireRoom(code)));
    }

    @PostMapping("/{code}/questions")
    public RoomDto setQuestions(@PathVariable String code, @RequestBody RoomRequests.SetQuestions request) {
        Room room = roomService.setQuestions(code, request.playerId(), request.questions());
        return RoomDto.from(room);
    }

    @PostMapping("/{code}/start")
    public RoomDto start(@PathVariable String code, @RequestBody RoomRequests.StartBattle request) {
        Room room = roomService.startBattle(code, request.playerId());
        return RoomDto.from(room);
    }

    @PostMapping("/{code}/messages")
    public RoomResponses.Chat chat(@PathVariable String code, @RequestBody RoomRequests.PostChat request) {
        ChatMessage message = roomService.postChat(code, request.playerId(), request.text());
        return new RoomResponses.Chat(message);
    }

    @PostMapping("/{code}/complete")
    public RoomResponses.Chat complete(@PathVariable String code, @RequestBody RoomRequests.CompleteQuestion request) {
        ChatMessage message = roomService.markComplete(code, request.playerId(), request.slug());
        return new RoomResponses.Chat(message);
    }
}
