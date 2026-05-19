package com.example.leetcodeBattle.api;

import com.example.leetcodeBattle.model.Question;
import com.example.leetcodeBattle.service.LeetCodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private final LeetCodeService leetCodeService;

    public QuestionController(LeetCodeService leetCodeService) {
        this.leetCodeService = leetCodeService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<Question>> search(
            @RequestParam(value = "q", required = false) String keyword,
            @RequestParam(value = "limit", defaultValue = "25") int limit
    ) {
        try {
            return ResponseEntity.ok(leetCodeService.search(keyword, limit));
        } catch (IOException e) {
            return ResponseEntity.status(502).body(List.of());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(504).body(List.of());
        }
    }
}
