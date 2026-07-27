package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.Bookmark;
import com.pyq.platform.entity.Question;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.BookmarkRepository;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import com.pyq.platform.mapper.QuestionMapper;

@RestController
@RequestMapping("/api")
@Transactional
public class BookmarkController {

    private final BookmarkRepository bookmarkRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final QuestionMapper questionMapper;

    public BookmarkController(BookmarkRepository bookmarkRepository, QuestionRepository questionRepository,
                              UserRepository userRepository, QuestionMapper questionMapper) {
        this.bookmarkRepository = bookmarkRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
        this.questionMapper = questionMapper;
    }

    // Bookmark question
    @PostMapping("/questions/{id}/bookmark")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> bookmarkQuestion(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        if (bookmarkRepository.existsByUserIdAndQuestionId(user.getId(), id)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Question is already bookmarked!"));
        }

        bookmarkRepository.save(Bookmark.builder()
                .user(user)
                .question(questionOpt.get())
                .build());

        return ResponseEntity.ok(new MessageResponse("Question bookmarked successfully!"));
    }

    // Unbookmark question
    @DeleteMapping("/questions/{id}/bookmark")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> unbookmarkQuestion(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        Optional<Bookmark> bookmarkOpt = bookmarkRepository.findByUserIdAndQuestionId(userDetails.getId(), id);
        if (bookmarkOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Bookmark not found!"));
        }

        bookmarkRepository.delete(bookmarkOpt.get());
        return ResponseEntity.ok(new MessageResponse("Bookmark removed successfully!"));
    }

    // List Bookmarks
    @GetMapping("/bookmarks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<QuestionDTO>> getBookmarks(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<Bookmark> bookmarks = bookmarkRepository.findByUserId(userDetails.getId());
        List<QuestionDTO> dtos = bookmarks.stream()
                .map(b -> convertToDTO(b.getQuestion()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    private QuestionDTO convertToDTO(Question question) {
        return questionMapper.convertToDTOFast(question);
    }
}
