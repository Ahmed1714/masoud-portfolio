package com.englishapp.learning.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.englishapp.learning.data.db.entities.LearningStatus
import com.englishapp.learning.data.repository.VocabularyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

data class ProgressUiState(
    val totalWords: Int = 0,
    val newCount: Int = 0,
    val learningCount: Int = 0,
    val reviewingCount: Int = 0,
    val masteredCount: Int = 0,
    val totalCorrect: Int = 0,
    val totalWrong: Int = 0
) {
    val masteredFraction: Float get() = if (totalWords == 0) 0f else masteredCount / totalWords.toFloat()
    val accuracyPercent: Int
        get() {
            val total = totalCorrect + totalWrong
            return if (total == 0) 0 else (totalCorrect * 100) / total
        }
}

@HiltViewModel
class ProgressViewModel @Inject constructor(
    repository: VocabularyRepository
) : ViewModel() {

    val uiState: StateFlow<ProgressUiState> = combine(
        repository.getAllWords(),
        repository.getAllProgress(),
        repository.getCountByStatus(LearningStatus.LEARNING),
        repository.getCountByStatus(LearningStatus.REVIEWING),
        repository.getCountByStatus(LearningStatus.MASTERED)
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        val words = values[0] as List<*>
        val allProgress = values[1] as List<com.englishapp.learning.data.db.entities.WordProgress>
        val learning = values[2] as Int
        val reviewing = values[3] as Int
        val mastered = values[4] as Int
        ProgressUiState(
            totalWords = words.size,
            newCount = (words.size - learning - reviewing - mastered).coerceAtLeast(0),
            learningCount = learning,
            reviewingCount = reviewing,
            masteredCount = mastered,
            totalCorrect = allProgress.sumOf { it.correctCount },
            totalWrong = allProgress.sumOf { it.wrongCount }
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ProgressUiState())
}
