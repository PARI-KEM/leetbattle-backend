package com.example.leetcodeBattle.service;

import com.example.leetcodeBattle.model.Question;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class LeetCodeService {

    private static final String GRAPHQL_URL = "https://leetcode.com/graphql";

    private static final String QUERY = """
            query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
              problemsetQuestionList: questionList(
                categorySlug: $categorySlug
                limit: $limit
                skip: $skip
                filters: $filters
              ) {
                questions: data {
                  difficulty
                  questionFrontendId
                  title
                  titleSlug
                  isPaidOnly
                  topicTags { name slug }
                }
              }
            }
            """;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    public List<Question> search(String keyword, int limit) throws IOException, InterruptedException {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        ObjectNode body = mapper.createObjectNode();
        body.put("query", QUERY);
        ObjectNode variables = body.putObject("variables");
        variables.put("categorySlug", "");
        variables.put("limit", safeLimit);
        variables.put("skip", 0);
        ObjectNode filters = variables.putObject("filters");
        if (keyword != null && !keyword.isBlank()) {
            filters.put("searchKeywords", keyword.strip());
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GRAPHQL_URL))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("User-Agent", "LeetBattle/1.0")
                .header("Referer", "https://leetcode.com/problemset/")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("LeetCode GraphQL returned HTTP " + response.statusCode());
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode questions = root.path("data").path("problemsetQuestionList").path("questions");
        if (!questions.isArray()) {
            return List.of();
        }

        List<Question> result = new ArrayList<>(questions.size());
        for (JsonNode node : questions) {
            if (node.path("isPaidOnly").asBoolean(false)) {
                continue;
            }
            List<String> tags = new ArrayList<>();
            for (JsonNode tag : node.path("topicTags")) {
                String slug = tag.path("slug").asText("");
                if (!slug.isBlank()) tags.add(slug);
            }
            result.add(new Question(
                    node.path("titleSlug").asText(""),
                    node.path("title").asText(""),
                    node.path("difficulty").asText(""),
                    node.path("questionFrontendId").asText(""),
                    tags
            ));
        }
        return result;
    }
}
