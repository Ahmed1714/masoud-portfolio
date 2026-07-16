package com.englishapp.learning.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.englishapp.learning.data.db.entities.WordEntity
import com.englishapp.learning.data.repository.ReviewQuality
import com.englishapp.learning.data.repository.VocabularyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FlashcardSessionState(
    val words: List<WordEntity> = emptyList(),
    val currentIndex: Int = 0,
    val isFlipped: Boolean = false,
    val correctCount: Int = 0,
    val totalReviewed: Int = 0,
    val isComplete: Boolean = false
) {
    val currentWord: WordEntity? get() = words.getOrNull(currentIndex)
    val progressFraction: Float get() = if (words.isEmpty()) 0f else totalReviewed / words.size.toFloat()
}

@HiltViewModel
class FlashcardViewModel @Inject constructor(
    private val repository: VocabularyRepository
) : ViewModel() {

    private val _state = MutableStateFlow(FlashcardSessionState())
    val state: StateFlow<FlashcardSessionState> = _state.asStateFlow()

    fun loadReviewSession() {
        viewModelScope.launch {
            val due = repository.getWordsDueForReview().first()
            val words = due.mapNotNull { repository.getWord(it.wordId) }
            _state.value = FlashcardSessionState(words = words)
        }
    }

    fun loadCategorySession(category: String) {
        viewModelScope.launch {
            val words = repository.getWordsByCategory(category).first()
            _state.value = FlashcardSessionState(words = words)
        }
    }

    fun flip() {
        _state.value = _state.value.copy(isFlipped = !_state.value.isFlipped)
    }

    fun submitAnswer(quality: ReviewQuality) {
        val current = _state.value
        val word = current.currentWord ?: return
        viewModelScope.launch {
            repository.submitReview(word.id, quality)
        }
        val nextIndex = current.currentIndex + 1
        val complete = nextIndex >= current.words.size
        _state.value = current.copy(
            currentIndex = if (complete) current.currentIndex else nextIndex,
            isFlipped = false,
            correctCount = current.correctCount + if (quality.score >= 3) 1 else 0,
            totalReviewed = current.totalReviewed + 1,
            isComplete = complete
        )
    }

    fun resetSession() {
        _state.value = FlashcardSessionState()
    }
}
