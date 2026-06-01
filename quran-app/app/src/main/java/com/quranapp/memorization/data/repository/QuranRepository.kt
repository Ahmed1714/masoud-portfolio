package com.quranapp.memorization.data.repository

import com.quranapp.memorization.data.api.QuranApiService
import com.quranapp.memorization.data.db.dao.ProgressDao
import com.quranapp.memorization.data.db.dao.SurahDao
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.CachedSurah
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QuranRepository @Inject constructor(
    private val api: QuranApiService,
    private val surahDao: SurahDao,
    private val progressDao: ProgressDao
) {

    fun getAllSurahs(): Flow<List<CachedSurah>> = surahDao.getAllSurahs()

    fun getAyahsForSurah(surahNumber: Int): Flow<List<CachedAyah>> =
        surahDao.getAyahsForSurah(surahNumber)

    fun getProgressForSurah(surahNumber: Int): Flow<List<MemorizationProgress>> =
        progressDao.getProgressForSurah(surahNumber)

    fun getAllProgress(): Flow<List<MemorizationProgress>> = progressDao.getAllProgress()

    fun getMemorizedSurahCount(): Flow<Int> = progressDao.getMemorizedSurahCount()

    fun getCountByStatus(status: MemorizationStatus): Flow<Int> =
        progressDao.getCountByStatus(status)

    fun getAyahsDueForReview(cutoffTime: Long): Flow<List<MemorizationProgress>> =
        progressDao.getAyahsDueForReview(cutoffTime)

    suspend fun loadSurahsIfNeeded() {
        if (surahDao.getSurahCount() == 0) {
            val response = api.getAllSurahs()
            val entities = response.data.map {
                CachedSurah(
                    number = it.number,
                    name = it.name,
                    englishName = it.englishName,
                    englishNameTranslation = it.englishNameTranslation,
                    numberOfAyahs = it.numberOfAyahs,
                    revelationType = it.revelationType
                )
            }
            surahDao.insertSurahs(entities)
        }
    }

    suspend fun loadAyahsIfNeeded(surahNumber: Int) {
        if (surahDao.getAyahCountForSurah(surahNumber) == 0) {
            val response = api.getSurahWithText(surahNumber)
            val ayahs = response.data.ayahs.map {
                CachedAyah(
                    globalNumber = it.number,
                    surahNumber = surahNumber,
                    numberInSurah = it.numberInSurah,
                    text = it.text,
                    juz = it.juz,
                    page = it.page
                )
            }
            surahDao.insertAyahs(ayahs)
        }
    }

    suspend fun upsertProgress(progress: MemorizationProgress) =
        progressDao.upsertProgress(progress)

    suspend fun recordReview(
        globalAyahNumber: Int,
        surahNumber: Int,
        numberInSurah: Int,
        isCorrect: Boolean
    ) {
        val existing = progressDao.getProgress(globalAyahNumber)
        if (existing == null) {
            progressDao.upsertProgress(
                MemorizationProgress(
                    globalAyahNumber = globalAyahNumber,
                    surahNumber = surahNumber,
                    numberInSurah = numberInSurah,
                    status = if (isCorrect) MemorizationStatus.IN_PROGRESS else MemorizationStatus.IN_PROGRESS,
                    repetitions = 1,
                    lastReviewedAt = System.currentTimeMillis(),
                    correctCount = if (isCorrect) 1 else 0,
                    wrongCount = if (isCorrect) 0 else 1
                )
            )
        } else {
            val newStatus = when {
                isCorrect && existing.correctCount >= 4 -> MemorizationStatus.MEMORIZED
                isCorrect -> MemorizationStatus.IN_PROGRESS
                else -> MemorizationStatus.NEEDS_REVIEW
            }
            progressDao.updateReview(
                globalAyahNumber = globalAyahNumber,
                status = newStatus,
                timestamp = System.currentTimeMillis(),
                isCorrect = isCorrect
            )
        }
    }

    fun getAudioUrl(globalAyahNumber: Int, useMujawwad: Boolean = false): String {
        val edition = if (useMujawwad) "ar.abdulbasitmujawwad" else "ar.abdulbasitmurattal"
        return "https://cdn.islamic.network/quran/audio/128/$edition/$globalAyahNumber.mp3"
    }
}
