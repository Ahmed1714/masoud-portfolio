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

data class QuizQuestion(
    val word: WordEntity,
    val options: List<WordEntity>
)

data class QuizUiState(
    val questions: List<QuizQuestion> = emptyList(),
    val currentIndex: Int = 0,
    val score: Int = 0,
    val selectedOptionId: Int? = null,
    val isAnswered: Boolean = false,
    val isComplete: Boolean = false
) {
    val currentQuestion: QuizQuestion? get() = questions.getOrNull(currentIndex)
}

@HiltViewModel
class QuizViewModel @Inject constructor(
    private val repository: VocabularyRepository
) : ViewModel() {

    private val _state = MutableStateFlow(QuizUiState())
    val state: StateFlow<QuizUiState> = _state.asStateFlow()

    fun loadQuiz(category: String?, questionCount: Int = 10) {
        viewModelScope.launch {
            val pool = if (category != null) {
                repository.getWordsByCategory(category).first()
            } else {
                repository.getAllWords().first()
            }
            val chosen = pool.shuffled().take(questionCount)
            val questions = chosen.map { word ->
                val distractors = repository.getQuizDistractors(word.id, 3)
                QuizQuestion(word = word, options = (distractors + word).shuffled())
            }
            _state.value = QuizUiState(questions = questions)
        }
    }

    fun selectAnswer(optionId: Int) {
        val current = _state.value
        val question = current.currentQuestion ?: return
        if (current.isAnswered) return

        val isCorrect = optionId == question.word.id
        viewModelScope.launch {
            repository.submitReview(
                question.word.id,
                if (isCorrect) ReviewQuality.GOOD else ReviewQuality.AGAIN
            )
        }
        _state.value = current.copy(
            selectedOptionId = optionId,
            isAnswered = true,
            score = current.score + if (isCorrect) 1 else 0
        )
    }

    fun nextQuestion() {
        val current = _state.value
        val nextIndex = current.currentIndex + 1
        val complete = nextIndex >= current.questions.size
        _state.value = current.copy(
            currentIndex = if (complete) current.currentIndex else nextIndex,
            selectedOptionId = null,
            isAnswered = false,
            isComplete = complete
        )
    }

    fun resetQuiz() {
        _state.value = QuizUiState()
    }
}
