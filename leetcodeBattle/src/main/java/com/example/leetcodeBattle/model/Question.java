package com.example.leetcodeBattle.model;

import java.util.List;

public record Question(
        String titleSlug,
        String title,
        String difficulty,
        String frontendId,
        List<String> topicTags
) {
}
