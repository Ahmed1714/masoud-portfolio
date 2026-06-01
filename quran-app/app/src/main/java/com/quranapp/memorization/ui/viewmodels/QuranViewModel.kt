package com.quranapp.memorization.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.CachedSurah
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import com.quranapp.memorization.data.repository.QuranRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class QuranViewModel @Inject constructor(
    private val repository: QuranRepository
) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val surahs: StateFlow<List<CachedSurah>> = repository.getAllSurahs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val filteredSurahs: StateFlow<List<CachedSurah>> = combine(surahs, searchQuery) { list, query ->
        if (query.isBlank()) list
        else list.filter {
            it.englishName.contains(query, ignoreCase = true) ||
            it.name.contains(query) ||
            it.number.toString() == query
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val memorizedCount: StateFlow<Int> = repository.getCountByStatus(MemorizationStatus.MEMORIZED)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val inProgressCount: StateFlow<Int> = repository.getCountByStatus(MemorizationStatus.IN_PROGRESS)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val memorizedSurahCount: StateFlow<Int> = repository.getMemorizedSurahCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    init {
        loadSurahs()
    }

    private fun loadSurahs() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.loadSurahsIfNeeded()
                _error.value = null
            } catch (e: Exception) {
                _error.value = "تعذر تحميل قائمة السور. تأكد من الاتصال بالإنترنت."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun clearError() { _error.value = null }
}

@HiltViewModel
class SurahDetailViewModel @Inject constructor(
    private val repository: QuranRepository
) : ViewModel() {

    private val _surahNumber = MutableStateFlow(1)
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    val ayahs: StateFlow<List<CachedAyah>> = _surahNumber
        .flatMapLatest { repository.getAyahsForSurah(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val progressMap: StateFlow<Map<Int, MemorizationProgress>> = _surahNumber
        .flatMapLatest { repository.getProgressForSurah(it) }
        .map { list -> list.associateBy { it.globalAyahNumber } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    fun loadSurah(surahNumber: Int) {
        _surahNumber.value = surahNumber
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.loadAyahsIfNeeded(surahNumber)
            } catch (e: Exception) {
                // silently fail if cached data exists
            } finally {
                _isLoading.value = false
            }
        }
    }
}
