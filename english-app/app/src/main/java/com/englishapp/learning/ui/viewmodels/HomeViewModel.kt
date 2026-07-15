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
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val categories: List<String> = emptyList(),
    val totalWords: Int = 0,
    val dueCount: Int = 0,
    val newCount: Int = 0,
    val learningCount: Int = 0,
    val reviewingCount: Int = 0,
    val masteredCount: Int = 0
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: VocabularyRepository
) : ViewModel() {

    val uiState: StateFlow<HomeUiState> = combine(
        repository.getCategories(),
        repository.getAllWords(),
        repository.getDueCount(),
        repository.getCountByStatus(LearningStatus.LEARNING),
        repository.getCountByStatus(LearningStatus.REVIEWING),
        repository.getCountByStatus(LearningStatus.MASTERED)
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        val categories = values[0] as List<String>
        val words = values[1] as List<*>
        val due = values[2] as Int
        val learning = values[3] as Int
        val reviewing = values[4] as Int
        val mastered = values[5] as Int
        HomeUiState(
            categories = categories,
            totalWords = words.size,
            dueCount = due,
            newCount = (words.size - learning - reviewing - mastered).coerceAtLeast(0),
            learningCount = learning,
            reviewingCount = reviewing,
            masteredCount = mastered
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState())

    init {
        viewModelScope.launch { repository.seedIfNeeded() }
    }
}
