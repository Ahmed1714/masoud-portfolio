package com.quranapp.memorization.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import com.quranapp.memorization.data.repository.QuranRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class TasmiResult { CORRECT, ACCEPTABLE, WRONG }

data class TasmiAyahState(
    val ayah: CachedAyah,
    val result: TasmiResult? = null,
    val isRevealed: Boolean = false
)

@HiltViewModel
class MemorizationViewModel @Inject constructor(
    private val repository: QuranRepository
) : ViewModel() {

    private val _surahNumber = MutableStateFlow(1)

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    private val _isTextHidden = MutableStateFlow(false)
    val isTextHidden: StateFlow<Boolean> = _isTextHidden.asStateFlow()

    val ayahs: StateFlow<List<CachedAyah>> = _surahNumber
        .flatMapLatest { repository.getAyahsForSurah(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val progressMap: StateFlow<Map<Int, MemorizationProgress>> = _surahNumber
        .flatMapLatest { repository.getProgressForSurah(it) }
        .map { list -> list.associateBy { it.globalAyahNumber } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    val currentAyah: StateFlow<CachedAyah?> = combine(ayahs, _currentIndex) { list, idx ->
        list.getOrNull(idx)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    // Tasmi state
    private val _tasmiStates = MutableStateFlow<List<TasmiAyahState>>(emptyList())
    val tasmiStates: StateFlow<List<TasmiAyahState>> = _tasmiStates.asStateFlow()

    private val _tasmiCurrentIndex = MutableStateFlow(0)
    val tasmiCurrentIndex: StateFlow<Int> = _tasmiCurrentIndex.asStateFlow()

    private val _tasmiSessionComplete = MutableStateFlow(false)
    val tasmiSessionComplete: StateFlow<Boolean> = _tasmiSessionComplete.asStateFlow()

    fun loadSurah(surahNumber: Int) {
        _surahNumber.value = surahNumber
        _currentIndex.value = 0
        viewModelScope.launch {
            repository.loadAyahsIfNeeded(surahNumber)
        }
    }

    fun nextAyah() {
        val size = ayahs.value.size
        if (_currentIndex.value < size - 1) _currentIndex.value++
    }

    fun previousAyah() {
        if (_currentIndex.value > 0) _currentIndex.value--
    }

    fun goToAyah(index: Int) {
        _currentIndex.value = index.coerceIn(0, ayahs.value.size - 1)
    }

    fun toggleTextVisibility() { _isTextHidden.value = !_isTextHidden.value }

    fun markAyahStatus(ayah: CachedAyah, status: MemorizationStatus) {
        viewModelScope.launch {
            repository.upsertProgress(
                MemorizationProgress(
                    globalAyahNumber = ayah.globalNumber,
                    surahNumber = ayah.surahNumber,
                    numberInSurah = ayah.numberInSurah,
                    status = status,
                    lastReviewedAt = System.currentTimeMillis()
                )
            )
        }
    }

    // ─── Tasmi (Recitation Test) ────────────────────────────────────────────

    fun startTasmiSession(startIndex: Int = 0) {
        val currentAyahs = ayahs.value
        if (currentAyahs.isEmpty()) return
        _tasmiStates.value = currentAyahs.drop(startIndex).map { TasmiAyahState(it) }
        _tasmiCurrentIndex.value = 0
        _tasmiSessionComplete.value = false
    }

    fun revealCurrentAyah() {
        val states = _tasmiStates.value.toMutableList()
        val idx = _tasmiCurrentIndex.value
        if (idx < states.size) {
            states[idx] = states[idx].copy(isRevealed = true)
            _tasmiStates.value = states
        }
    }

    fun markTasmiResult(result: TasmiResult) {
        val states = _tasmiStates.value.toMutableList()
        val idx = _tasmiCurrentIndex.value
        if (idx >= states.size) return

        states[idx] = states[idx].copy(result = result, isRevealed = true)
        _tasmiStates.value = states

        val ayah = states[idx].ayah
        viewModelScope.launch {
            repository.recordReview(
                globalAyahNumber = ayah.globalNumber,
                surahNumber = ayah.surahNumber,
                numberInSurah = ayah.numberInSurah,
                isCorrect = result == TasmiResult.CORRECT
            )
        }

        if (idx < states.size - 1) {
            _tasmiCurrentIndex.value = idx + 1
        } else {
            _tasmiSessionComplete.value = true
        }
    }

    fun resetTasmiSession() {
        _tasmiStates.value = emptyList()
        _tasmiCurrentIndex.value = 0
        _tasmiSessionComplete.value = false
    }

    fun getTasmiSummary(): Triple<Int, Int, Int> {
        val states = _tasmiStates.value
        val correct = states.count { it.result == TasmiResult.CORRECT }
        val acceptable = states.count { it.result == TasmiResult.ACCEPTABLE }
        val wrong = states.count { it.result == TasmiResult.WRONG }
        return Triple(correct, acceptable, wrong)
    }
}
