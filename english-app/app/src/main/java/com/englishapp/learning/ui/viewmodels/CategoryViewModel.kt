package com.englishapp.learning.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.englishapp.learning.data.db.entities.WordEntity
import com.englishapp.learning.data.repository.VocabularyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class CategoryViewModel @Inject constructor(
    private val repository: VocabularyRepository
) : ViewModel() {

    private val category = MutableStateFlow("")

    val words: StateFlow<List<WordEntity>> = category
        .flatMapLatest { repository.getWordsByCategory(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun loadCategory(name: String) {
        category.value = name
    }
}
